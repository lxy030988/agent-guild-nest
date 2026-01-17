import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Web3Provider } from '../web3/web3.provider';
import { ProposalsService } from './proposals.service';
import { VotingService } from './voting.service';
import { StakingService } from './staking.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  Address,
  parseAbiItem,
  decodeEventLog,
  Log,
  Hash,
  GetLogsReturnType,
} from 'viem';
import { ProposalStatus, VoteType } from '@prisma/client';

/**
 * Indexer Service
 * Handles historical event indexing and batch processing
 */
@Injectable()
export class IndexerService {
  private readonly logger = new Logger(IndexerService.name);
  private readonly BATCH_SIZE = 10000; // Process 10k blocks at a time
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 2000; // 2 seconds

  // Contract addresses
  private governorAddress: Address;
  private stakingAddress: Address;
  private startBlock: bigint;

  constructor(
    private readonly web3Provider: Web3Provider,
    private readonly configService: ConfigService,
    private readonly proposalsService: ProposalsService,
    private readonly votingService: VotingService,
    private readonly stakingService: StakingService,
    private readonly prisma: PrismaService,
  ) {
    this.governorAddress = this.configService.get<Address>(
      'GOVERNOR_CONTRACT_ADDRESS',
      '0x0000000000000000000000000000000000000000',
    );
    this.stakingAddress = this.configService.get<Address>(
      'STAKING_CONTRACT_ADDRESS',
      '0x0000000000000000000000000000000000000000',
    );
    this.startBlock = BigInt(
      this.configService.get<number>('START_BLOCK', 0),
    );
  }

  /**
   * Index all historical events from deployment block
   */
  async indexHistoricalEvents(): Promise<void> {
    try {
      this.logger.log('Starting historical event indexing...');

      const client = this.web3Provider.getPublicClient();
      const currentBlock = await client.getBlockNumber();

      // Get last indexed block from database
      const lastIndexedBlock = await this.getLastIndexedBlock();
      const fromBlock = lastIndexedBlock > 0n ? lastIndexedBlock + 1n : this.startBlock;

      if (fromBlock >= currentBlock) {
        this.logger.log('Already up to date, no historical events to index');
        return;
      }

      this.logger.log(
        `Indexing events from block ${fromBlock} to ${currentBlock}`,
      );

      // Index in batches to avoid timeouts and memory issues
      let processedBlock = fromBlock;
      while (processedBlock < currentBlock) {
        const toBlock = processedBlock + BigInt(this.BATCH_SIZE) > currentBlock
          ? currentBlock
          : processedBlock + BigInt(this.BATCH_SIZE);

        this.logger.log(
          `Processing batch: ${processedBlock} to ${toBlock} (${Math.floor((Number(processedBlock - fromBlock) / Number(currentBlock - fromBlock)) * 100)}%)`,
        );

        await this.indexBlockRange(processedBlock, toBlock);

        // Save progress
        await this.saveLastIndexedBlock(toBlock);

        processedBlock = toBlock + 1n;

        // Small delay to avoid overwhelming the RPC
        await this.delay(500);
      }

      this.logger.log('Historical event indexing completed');
    } catch (error) {
      this.logger.error('Error during historical indexing:', error);
      throw error;
    }
  }

  /**
   * Index events for a specific block range
   */
  private async indexBlockRange(fromBlock: bigint, toBlock: bigint): Promise<void> {
    const client = this.web3Provider.getPublicClient();

    try {
      // Fetch all events in parallel with retry logic
      const [
        proposalCreatedLogs,
        voteCastLogs,
        proposalExecutedLogs,
        proposalCanceledLogs,
        stakedLogs,
        unstakedLogs,
      ] = await Promise.all([
        this.retryGetLogs(() =>
          client.getLogs({
            address: this.governorAddress,
            event: parseAbiItem(
              'event ProposalCreated(uint256 proposalId, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 startBlock, uint256 endBlock, string description)',
            ),
            fromBlock,
            toBlock,
          }),
        ),
        this.retryGetLogs(() =>
          client.getLogs({
            address: this.governorAddress,
            event: parseAbiItem(
              'event VoteCast(address indexed voter, uint256 proposalId, uint8 support, uint256 weight, string reason)',
            ),
            fromBlock,
            toBlock,
          }),
        ),
        this.retryGetLogs(() =>
          client.getLogs({
            address: this.governorAddress,
            event: parseAbiItem('event ProposalExecuted(uint256 proposalId)'),
            fromBlock,
            toBlock,
          }),
        ),
        this.retryGetLogs(() =>
          client.getLogs({
            address: this.governorAddress,
            event: parseAbiItem('event ProposalCanceled(uint256 proposalId)'),
            fromBlock,
            toBlock,
          }),
        ),
        this.retryGetLogs(() =>
          client.getLogs({
            address: this.stakingAddress,
            event: parseAbiItem(
              'event Staked(address indexed user, uint256 amount, uint256 lockPeriod, uint256 multiplier)',
            ),
            fromBlock,
            toBlock,
          }),
        ),
        this.retryGetLogs(() =>
          client.getLogs({
            address: this.stakingAddress,
            event: parseAbiItem(
              'event Unstaked(address indexed user, uint256 amount)',
            ),
            fromBlock,
            toBlock,
          }),
        ),
      ]);

      // Process events in order
      await this.processProposalCreatedLogs(proposalCreatedLogs);
      await this.processVoteCastLogs(voteCastLogs);
      await this.processProposalExecutedLogs(proposalExecutedLogs);
      await this.processProposalCanceledLogs(proposalCanceledLogs);
      await this.processStakedLogs(stakedLogs);
      await this.processUnstakedLogs(unstakedLogs);

      this.logger.debug(
        `Indexed ${proposalCreatedLogs.length} ProposalCreated, ${voteCastLogs.length} VoteCast, ${stakedLogs.length} Staked, ${unstakedLogs.length} Unstaked events`,
      );
    } catch (error) {
      this.logger.error(
        `Error indexing block range ${fromBlock}-${toBlock}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Process ProposalCreated logs
   */
  private async processProposalCreatedLogs(logs: GetLogsReturnType): Promise<void> {
    for (const log of logs) {
      try {
        if (!log.blockNumber) {
          this.logger.warn('ProposalCreated log has no block number, skipping');
          continue;
        }

        const decoded = decodeEventLog({
          abi: [
            parseAbiItem(
              'event ProposalCreated(uint256 proposalId, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 startBlock, uint256 endBlock, string description)',
            ),
          ],
          data: log.data,
          topics: log.topics,
        });

        const args = decoded.args as {
          proposalId: bigint;
          proposer: Address;
          targets: Address[];
          values: bigint[];
          signatures: string[];
          calldatas: string[];
          startBlock: bigint;
          endBlock: bigint;
          description: string;
        };

        // Check if proposal already exists
        const existing = await this.prisma.proposal.findUnique({
          where: { proposalId: args.proposalId },
        });

        if (existing) {
          continue;
        }

        // Parse description (format: "title|||description")
        const [title, description] = args.description.split('|||');

        // Get block data for timestamp
        const client = this.web3Provider.getPublicClient();
        const block = await client.getBlock({ blockNumber: log.blockNumber });

        // Create proposal
        await this.proposalsService.create({
          proposalId: args.proposalId.toString(),
          title: title || 'Untitled Proposal',
          description: description || args.description,
          proposer: args.proposer.toLowerCase(),
          status: ProposalStatus.PENDING,
          transactionHash: log.transactionHash as Hash,
          blockNumber: log.blockNumber.toString(),
          startBlock: args.startBlock.toString(),
          endBlock: args.endBlock.toString(),
          startTime: new Date(Number(block.timestamp) * 1000).toISOString(),
          endTime: new Date(
            Number(block.timestamp) * 1000 + 7 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        });
      } catch (error) {
        this.logger.error('Error processing ProposalCreated log:', error);
      }
    }
  }

  /**
   * Process VoteCast logs
   */
  private async processVoteCastLogs(logs: GetLogsReturnType): Promise<void> {
    for (const log of logs) {
      try {
        const decoded = decodeEventLog({
          abi: [
            parseAbiItem(
              'event VoteCast(address indexed voter, uint256 proposalId, uint8 support, uint256 weight, string reason)',
            ),
          ],
          data: log.data,
          topics: log.topics,
        });

        const args = decoded.args as {
          voter: Address;
          proposalId: bigint;
          support: number;
          weight: bigint;
          reason: string;
        };

        // Find proposal by proposalId
        const proposal = await this.prisma.proposal.findUnique({
          where: { proposalId: args.proposalId },
        });

        if (!proposal) {
          continue;
        }

        // Check if vote already exists
        const existing = await this.prisma.vote.findUnique({
          where: {
            proposalId_voter: {
              proposalId: proposal.id,
              voter: args.voter.toLowerCase(),
            },
          },
        });

        if (existing) {
          continue;
        }

        // Map support value to VoteType
        const voteType =
          args.support === 0
            ? VoteType.AGAINST
            : args.support === 1
              ? VoteType.FOR
              : VoteType.ABSTAIN;

        // Create vote
        await this.votingService.create({
          proposalId: proposal.id,
          voter: args.voter.toLowerCase(),
          support: voteType,
          votingPower: args.weight.toString(),
          reason: args.reason || undefined,
          transactionHash: log.transactionHash as Hash,
          blockNumber: log.blockNumber.toString(),
        });
      } catch (error) {
        this.logger.error('Error processing VoteCast log:', error);
      }
    }
  }

  /**
   * Process ProposalExecuted logs
   */
  private async processProposalExecutedLogs(logs: GetLogsReturnType): Promise<void> {
    for (const log of logs) {
      try {
        const decoded = decodeEventLog({
          abi: [parseAbiItem('event ProposalExecuted(uint256 proposalId)')],
          data: log.data,
          topics: log.topics,
        });

        const args = decoded.args as { proposalId: bigint };

        // Find proposal by proposalId
        const proposal = await this.prisma.proposal.findUnique({
          where: { proposalId: args.proposalId },
        });

        if (!proposal || proposal.executed) {
          continue;
        }

        // Mark as executed
        await this.proposalsService.markAsExecuted(
          proposal.id,
          log.transactionHash as Hash,
        );
      } catch (error) {
        this.logger.error('Error processing ProposalExecuted log:', error);
      }
    }
  }

  /**
   * Process ProposalCanceled logs
   */
  private async processProposalCanceledLogs(logs: GetLogsReturnType): Promise<void> {
    for (const log of logs) {
      try {
        const decoded = decodeEventLog({
          abi: [parseAbiItem('event ProposalCanceled(uint256 proposalId)')],
          data: log.data,
          topics: log.topics,
        });

        const args = decoded.args as { proposalId: bigint };

        // Find proposal by proposalId
        const proposal = await this.prisma.proposal.findUnique({
          where: { proposalId: args.proposalId },
        });

        if (!proposal || proposal.canceled) {
          continue;
        }

        // Mark as canceled
        await this.proposalsService.markAsCanceled(proposal.id);
      } catch (error) {
        this.logger.error('Error processing ProposalCanceled log:', error);
      }
    }
  }

  /**
   * Process Staked logs
   */
  private async processStakedLogs(logs: GetLogsReturnType): Promise<void> {
    for (const log of logs) {
      try {
        const decoded = decodeEventLog({
          abi: [
            parseAbiItem(
              'event Staked(address indexed user, uint256 amount, uint256 lockPeriod, uint256 multiplier)',
            ),
          ],
          data: log.data,
          topics: log.topics,
        });

        const args = decoded.args as {
          user: Address;
          amount: bigint;
          lockPeriod: bigint;
          multiplier: bigint;
        };

        // Get block data for timestamp
        const client = this.web3Provider.getPublicClient();
        const block = await client.getBlock({ blockNumber: log.blockNumber });

        // Calculate unlock time
        const unlockAt = new Date(
          (Number(block.timestamp) + Number(args.lockPeriod)) * 1000,
        );

        // Create stake record
        await this.stakingService.createStake({
          walletAddress: args.user.toLowerCase(),
          amount: args.amount.toString(),
          lockPeriod: Number(args.lockPeriod),
          multiplier: Number(args.multiplier) / 100,
          unlockAt,
          transactionHash: log.transactionHash as Hash,
          blockNumber: log.blockNumber.toString(),
        });
      } catch (error) {
        this.logger.error('Error processing Staked log:', error);
      }
    }
  }

  /**
   * Process Unstaked logs
   */
  private async processUnstakedLogs(logs: GetLogsReturnType): Promise<void> {
    for (const log of logs) {
      try {
        const decoded = decodeEventLog({
          abi: [
            parseAbiItem(
              'event Unstaked(address indexed user, uint256 amount)',
            ),
          ],
          data: log.data,
          topics: log.topics,
        });

        const args = decoded.args as {
          user: Address;
          amount: bigint;
        };

        // Find the most recent active stake for this user
        const stake = await this.prisma.stake.findFirst({
          where: {
            walletAddress: args.user.toLowerCase(),
            withdrawn: false,
          },
          orderBy: {
            stakedAt: 'desc',
          },
        });

        if (!stake) {
          continue;
        }

        // Mark stake as withdrawn
        await this.stakingService.withdrawStake(
          stake.id,
          log.transactionHash as Hash,
        );
      } catch (error) {
        this.logger.error('Error processing Unstaked log:', error);
      }
    }
  }

  /**
   * Get last indexed block from database
   */
  private async getLastIndexedBlock(): Promise<bigint> {
    try {
      // Check the highest block number in proposals
      const lastProposal = await this.prisma.proposal.findFirst({
        orderBy: { blockNumber: 'desc' },
        select: { blockNumber: true },
      });

      // Check the highest block number in votes
      const lastVote = await this.prisma.vote.findFirst({
        orderBy: { blockNumber: 'desc' },
        select: { blockNumber: true },
      });

      // Check the highest block number in stakes
      const lastStake = await this.prisma.stake.findFirst({
        orderBy: { blockNumber: 'desc' },
        select: { blockNumber: true },
      });

      const blocks = [
        lastProposal?.blockNumber || 0n,
        lastVote?.blockNumber || 0n,
        lastStake?.blockNumber || 0n,
      ];

      return blocks.reduce((max, block) => (block > max ? block : max), 0n);
    } catch (error) {
      this.logger.error('Error getting last indexed block:', error);
      return 0n;
    }
  }

  /**
   * Save last indexed block to a metadata table
   */
  private async saveLastIndexedBlock(blockNumber: bigint): Promise<void> {
    // This could be stored in a dedicated metadata table
    // For now, we rely on the highest block number in the data
    this.logger.debug(`Saved progress: block ${blockNumber}`);
  }

  /**
   * Retry a function with exponential backoff
   */
  private async retryGetLogs<T>(
    fn: () => Promise<T>,
    retries = this.MAX_RETRIES,
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (retries > 0) {
        this.logger.warn(
          `Error fetching logs, retrying... (${retries} attempts left)`,
        );
        await this.delay(this.RETRY_DELAY);
        return this.retryGetLogs(fn, retries - 1);
      }
      throw error;
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Manually trigger re-indexing from a specific block
   */
  async reindexFromBlock(fromBlock: bigint): Promise<void> {
    const client = this.web3Provider.getPublicClient();
    const currentBlock = await client.getBlockNumber();

    this.logger.log(`Re-indexing from block ${fromBlock} to ${currentBlock}`);

    let processedBlock = fromBlock;
    while (processedBlock < currentBlock) {
      const toBlock = processedBlock + BigInt(this.BATCH_SIZE) > currentBlock
        ? currentBlock
        : processedBlock + BigInt(this.BATCH_SIZE);

      await this.indexBlockRange(processedBlock, toBlock);
      processedBlock = toBlock + 1n;
      await this.delay(500);
    }

    this.logger.log('Re-indexing completed');
  }
}
