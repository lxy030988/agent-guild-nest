import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Web3Provider } from '../web3/web3.provider';
import { ProposalsService } from './proposals.service';
import { VotingService } from './voting.service';
import { StakingService } from './staking.service';
import { TreasuryService } from './treasury.service';
import { IndexerService } from './indexer.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  Address,
  parseAbiItem,
  decodeEventLog,
  Log,
  Hash,
  formatUnits,
} from 'viem';
import { ProposalStatus, VoteType } from '@prisma/client';

/**
 * Event Listener Service
 * Monitors blockchain events and syncs data to the database in real-time
 */
@Injectable()
export class EventListenerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventListenerService.name);
  private unwatchProposalCreated?: () => void;
  private unwatchVoteCast?: () => void;
  private unwatchStaked?: () => void;
  private unwatchUnstaked?: () => void;
  private unwatchProposalExecuted?: () => void;
  private unwatchProposalCanceled?: () => void;
  private isListening = false;

  // Contract addresses
  private governorAddress: Address;
  private stakingAddress: Address;
  private treasuryAddress: Address;

  constructor(
    private readonly web3Provider: Web3Provider,
    private readonly configService: ConfigService,
    private readonly proposalsService: ProposalsService,
    private readonly votingService: VotingService,
    private readonly stakingService: StakingService,
    private readonly treasuryService: TreasuryService,
    private readonly indexerService: IndexerService,
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
    this.treasuryAddress = this.configService.get<Address>(
      'TREASURY_ADDRESS',
      '0x0000000000000000000000000000000000000000',
    );
  }

  /**
   * Initialize event listeners on module startup
   */
  async onModuleInit() {
    try {
      // First, index historical events
      this.logger.log('Starting historical event indexing...');
      await this.indexerService.indexHistoricalEvents();
      this.logger.log('Historical event indexing completed');

      // Then start real-time event listeners
      await this.startListening();
    } catch (error) {
      this.logger.error('Failed to initialize event listeners:', error);
    }
  }

  /**
   * Clean up event listeners on module shutdown
   */
  async onModuleDestroy() {
    await this.stopListening();
  }

  /**
   * Start listening to blockchain events
   */
  async startListening() {
    if (this.isListening) {
      this.logger.warn('Event listeners are already running');
      return;
    }

    const client = this.web3Provider.getPublicClient();

    try {
      // Listen to ProposalCreated events
      this.unwatchProposalCreated = client.watchEvent({
        address: this.governorAddress,
        event: parseAbiItem(
          'event ProposalCreated(uint256 proposalId, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 startBlock, uint256 endBlock, string description)',
        ),
        onLogs: (logs) => this.handleProposalCreatedEvents(logs),
        onError: (error) => {
          this.logger.error('Error in ProposalCreated listener:', error);
        },
      });

      // Listen to VoteCast events
      this.unwatchVoteCast = client.watchEvent({
        address: this.governorAddress,
        event: parseAbiItem(
          'event VoteCast(address indexed voter, uint256 proposalId, uint8 support, uint256 weight, string reason)',
        ),
        onLogs: (logs) => this.handleVoteCastEvents(logs),
        onError: (error) => {
          this.logger.error('Error in VoteCast listener:', error);
        },
      });

      // Listen to ProposalExecuted events
      this.unwatchProposalExecuted = client.watchEvent({
        address: this.governorAddress,
        event: parseAbiItem('event ProposalExecuted(uint256 proposalId)'),
        onLogs: (logs) => this.handleProposalExecutedEvents(logs),
        onError: (error) => {
          this.logger.error('Error in ProposalExecuted listener:', error);
        },
      });

      // Listen to ProposalCanceled events
      this.unwatchProposalCanceled = client.watchEvent({
        address: this.governorAddress,
        event: parseAbiItem('event ProposalCanceled(uint256 proposalId)'),
        onLogs: (logs) => this.handleProposalCanceledEvents(logs),
        onError: (error) => {
          this.logger.error('Error in ProposalCanceled listener:', error);
        },
      });

      // Listen to Staked events
      this.unwatchStaked = client.watchEvent({
        address: this.stakingAddress,
        event: parseAbiItem(
          'event Staked(address indexed user, uint256 amount, uint256 lockPeriod, uint256 multiplier)',
        ),
        onLogs: (logs) => this.handleStakedEvents(logs),
        onError: (error) => {
          this.logger.error('Error in Staked listener:', error);
        },
      });

      // Listen to Unstaked events
      this.unwatchUnstaked = client.watchEvent({
        address: this.stakingAddress,
        event: parseAbiItem(
          'event Unstaked(address indexed user, uint256 amount)',
        ),
        onLogs: (logs) => this.handleUnstakedEvents(logs),
        onError: (error) => {
          this.logger.error('Error in Unstaked listener:', error);
        },
      });

      this.isListening = true;
      this.logger.log('Event listeners started successfully');
    } catch (error) {
      this.logger.error('Failed to start event listeners:', error);
      throw error;
    }
  }

  /**
   * Stop listening to blockchain events
   */
  async stopListening() {
    if (!this.isListening) {
      return;
    }

    try {
      this.unwatchProposalCreated?.();
      this.unwatchVoteCast?.();
      this.unwatchStaked?.();
      this.unwatchUnstaked?.();
      this.unwatchProposalExecuted?.();
      this.unwatchProposalCanceled?.();

      this.isListening = false;
      this.logger.log('Event listeners stopped successfully');
    } catch (error) {
      this.logger.error('Error stopping event listeners:', error);
    }
  }

  /**
   * Handle ProposalCreated events
   */
  private async handleProposalCreatedEvents(logs: Log[]) {
    for (const log of logs) {
      try {
        if (!log.blockNumber) {
          this.logger.warn('ProposalCreated event has no block number, skipping');
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

        // Parse description (format: "title|||description")
        const [title, description] = args.description.split('|||');

        // Get block data for timestamp
        const client = this.web3Provider.getPublicClient();
        const block = await client.getBlock({ blockNumber: log.blockNumber });

        // Check if proposal already exists
        const existing = await this.prisma.proposal.findUnique({
          where: { proposalId: args.proposalId },
        });

        if (existing) {
          this.logger.debug(
            `Proposal ${args.proposalId} already exists, skipping`,
          );
          continue;
        }

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
          ).toISOString(), // Estimate: 7 days
        });

        this.logger.log(
          `ProposalCreated: ID=${args.proposalId}, Proposer=${args.proposer}`,
        );
      } catch (error) {
        this.logger.error('Error handling ProposalCreated event:', error);
      }
    }
  }

  /**
   * Handle VoteCast events
   */
  private async handleVoteCastEvents(logs: Log[]) {
    for (const log of logs) {
      try {
        if (!log.blockNumber) {
          this.logger.warn('VoteCast event has no block number, skipping');
          continue;
        }

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
          this.logger.warn(
            `Proposal ${args.proposalId} not found for vote, skipping`,
          );
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
          this.logger.debug(
            `Vote already exists for proposal ${args.proposalId} and voter ${args.voter}, skipping`,
          );
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

        this.logger.log(
          `VoteCast: Voter=${args.voter}, ProposalId=${args.proposalId}, Support=${voteType}, Weight=${args.weight}`,
        );
      } catch (error) {
        this.logger.error('Error handling VoteCast event:', error);
      }
    }
  }

  /**
   * Handle ProposalExecuted events
   */
  private async handleProposalExecutedEvents(logs: Log[]) {
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

        if (!proposal) {
          this.logger.warn(
            `Proposal ${args.proposalId} not found for execution, skipping`,
          );
          continue;
        }

        // Mark as executed
        await this.proposalsService.markAsExecuted(
          proposal.id,
          log.transactionHash as Hash,
        );

        this.logger.log(`ProposalExecuted: ID=${args.proposalId}`);
      } catch (error) {
        this.logger.error('Error handling ProposalExecuted event:', error);
      }
    }
  }

  /**
   * Handle ProposalCanceled events
   */
  private async handleProposalCanceledEvents(logs: Log[]) {
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

        if (!proposal) {
          this.logger.warn(
            `Proposal ${args.proposalId} not found for cancellation, skipping`,
          );
          continue;
        }

        // Mark as canceled
        await this.proposalsService.markAsCanceled(proposal.id);

        this.logger.log(`ProposalCanceled: ID=${args.proposalId}`);
      } catch (error) {
        this.logger.error('Error handling ProposalCanceled event:', error);
      }
    }
  }

  /**
   * Handle Staked events
   */
  private async handleStakedEvents(logs: Log[]) {
    for (const log of logs) {
      try {
        if (!log.blockNumber) {
          this.logger.warn('Staked event has no block number, skipping');
          continue;
        }

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
          multiplier: Number(args.multiplier) / 100, // Assuming multiplier is in basis points
          unlockAt,
          transactionHash: log.transactionHash as Hash,
          blockNumber: log.blockNumber.toString(),
        });

        this.logger.log(
          `Staked: User=${args.user}, Amount=${args.amount}, LockPeriod=${args.lockPeriod}`,
        );
      } catch (error) {
        this.logger.error('Error handling Staked event:', error);
      }
    }
  }

  /**
   * Handle Unstaked events
   */
  private async handleUnstakedEvents(logs: Log[]) {
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
          this.logger.warn(
            `No active stake found for user ${args.user}, skipping`,
          );
          continue;
        }

        // Mark stake as withdrawn
        await this.stakingService.withdrawStake(
          stake.id,
          log.transactionHash as Hash,
        );

        this.logger.log(`Unstaked: User=${args.user}, Amount=${args.amount}`);
      } catch (error) {
        this.logger.error('Error handling Unstaked event:', error);
      }
    }
  }

  /**
   * Get listener status
   */
  getStatus() {
    return {
      isListening: this.isListening,
      contracts: {
        governor: this.governorAddress,
        staking: this.stakingAddress,
        treasury: this.treasuryAddress,
      },
    };
  }
}
