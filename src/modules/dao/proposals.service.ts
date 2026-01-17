import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ContractsService } from '../web3/contracts.service';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { QueryProposalsDto, PaginationMetaDto } from './dto/query-proposals.dto';
import { ProposalEntity } from './entities/proposal.entity';
import { ProposalStatus, ActivityType } from '@prisma/client';

/**
 * Proposals Service
 * Handles proposal CRUD operations and blockchain synchronization
 */
@Injectable()
export class ProposalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contractsService: ContractsService,
  ) {}

  /**
   * Create a new proposal record
   */
  async create(createProposalDto: CreateProposalDto): Promise<ProposalEntity> {
    const { proposalId, blockNumber, startBlock, endBlock, startTime, endTime, ...rest } = createProposalDto;

    const proposal = await this.prisma.proposal.create({
      data: {
        proposalId: BigInt(proposalId),
        blockNumber: BigInt(blockNumber),
        startBlock: BigInt(startBlock),
        endBlock: BigInt(endBlock),
        startTime: startTime ? new Date(startTime) : null,
        endTime: endTime ? new Date(endTime) : null,
        ...rest,
      },
    });

    // Create governance activity
    await this.prisma.governanceActivity.create({
      data: {
        activityType: ActivityType.PROPOSAL_CREATED,
        walletAddress: proposal.proposer,
        proposalId: proposal.id,
        description: `Created proposal: ${proposal.title}`,
        transactionHash: proposal.transactionHash,
        blockNumber: proposal.blockNumber,
      },
    });

    // Update governance stats
    await this.updateProposerStats(proposal.proposer, 'created');

    return new ProposalEntity(proposal);
  }

  /**
   * Find all proposals with filters and pagination
   */
  async findAll(query: QueryProposalsDto): Promise<{ data: ProposalEntity[]; meta: PaginationMetaDto }> {
    const { status, proposer, search, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = query;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (proposer) {
      where.proposer = proposer.toLowerCase();
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get total count
    const total = await this.prisma.proposal.count({ where });

    // Get proposals
    const proposals = await this.prisma.proposal.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        votes: {
          select: {
            id: true,
            voter: true,
            support: true,
            votingPower: true,
          },
        },
      },
    });

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);
    const meta: PaginationMetaDto = {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };

    return {
      data: proposals.map((p) => new ProposalEntity(p)),
      meta,
    };
  }

  /**
   * Find a single proposal by ID
   */
  async findOne(id: string): Promise<ProposalEntity> {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id },
      include: {
        votes: {
          orderBy: { timestamp: 'desc' },
        },
        transactions: true,
      },
    });

    if (!proposal) {
      throw new NotFoundException(`Proposal #${id} not found`);
    }

    return new ProposalEntity(proposal);
  }

  /**
   * Sync proposal data from blockchain
   */
  async syncFromBlockchain(proposalId: string): Promise<ProposalEntity> {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id: proposalId },
    });

    if (!proposal) {
      throw new NotFoundException(`Proposal #${proposalId} not found`);
    }

    try {
      // Get proposal state from blockchain
      const onChainState = await this.contractsService.getProposalState(proposal.proposalId);
      const status = this.mapProposalState(onChainState);

      // Get proposal details
      const onChainProposal = await this.contractsService.getProposal(proposal.proposalId);

      // Update proposal
      const updated = await this.prisma.proposal.update({
        where: { id: proposalId },
        data: {
          status,
          votesFor: onChainProposal[5] as bigint,
          votesAgainst: onChainProposal[6] as bigint,
          votesAbstain: onChainProposal[7] as bigint,
          canceled: onChainProposal[8] as boolean,
          executed: onChainProposal[9] as boolean,
          updatedAt: new Date(),
        },
      });

      return new ProposalEntity(updated);
    } catch (error) {
      throw new BadRequestException(`Failed to sync proposal from blockchain: ${error.message}`);
    }
  }

  /**
   * Get proposal votes
   */
  async getProposalVotes(proposalId: string, page = 1, limit = 10) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id: proposalId },
    });

    if (!proposal) {
      throw new NotFoundException(`Proposal #${proposalId} not found`);
    }

    const skip = (page - 1) * limit;

    const [votes, total] = await Promise.all([
      this.prisma.vote.findMany({
        where: { proposalId },
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
      }),
      this.prisma.vote.count({ where: { proposalId } }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: votes,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Update proposal status when executed
   */
  async markAsExecuted(proposalId: string, transactionHash: string): Promise<ProposalEntity> {
    const proposal = await this.prisma.proposal.update({
      where: { id: proposalId },
      data: {
        executed: true,
        executedAt: new Date(),
        executionTransactionHash: transactionHash,
        status: ProposalStatus.EXECUTED,
      },
    });

    // Create governance activity
    await this.prisma.governanceActivity.create({
      data: {
        activityType: ActivityType.PROPOSAL_EXECUTED,
        walletAddress: proposal.proposer,
        proposalId: proposal.id,
        description: `Executed proposal: ${proposal.title}`,
        transactionHash,
      },
    });

    // Update governance stats
    await this.updateProposerStats(proposal.proposer, 'executed');

    return new ProposalEntity(proposal);
  }

  /**
   * Update proposal status when canceled
   */
  async markAsCanceled(proposalId: string): Promise<ProposalEntity> {
    const proposal = await this.prisma.proposal.update({
      where: { id: proposalId },
      data: {
        canceled: true,
        canceledAt: new Date(),
        status: ProposalStatus.CANCELED,
      },
    });

    // Create governance activity
    await this.prisma.governanceActivity.create({
      data: {
        activityType: ActivityType.PROPOSAL_CANCELED,
        walletAddress: proposal.proposer,
        proposalId: proposal.id,
        description: `Canceled proposal: ${proposal.title}`,
      },
    });

    // Update governance stats
    await this.updateProposerStats(proposal.proposer, 'canceled');

    return new ProposalEntity(proposal);
  }

  /**
   * Map on-chain proposal state to ProposalStatus
   */
  private mapProposalState(state: number): ProposalStatus {
    const stateMap: Record<number, ProposalStatus> = {
      0: ProposalStatus.PENDING,
      1: ProposalStatus.ACTIVE,
      2: ProposalStatus.CANCELED,
      3: ProposalStatus.DEFEATED,
      4: ProposalStatus.SUCCEEDED,
      5: ProposalStatus.QUEUED,
      6: ProposalStatus.EXPIRED,
      7: ProposalStatus.EXECUTED,
    };

    return stateMap[state] || ProposalStatus.PENDING;
  }

  /**
   * Update proposer statistics
   */
  private async updateProposerStats(walletAddress: string, action: 'created' | 'executed' | 'canceled') {
    const stats = await this.prisma.governanceStats.upsert({
      where: { walletAddress: walletAddress.toLowerCase() },
      create: {
        walletAddress: walletAddress.toLowerCase(),
        proposalsCreated: action === 'created' ? 1 : 0,
        proposalsExecuted: action === 'executed' ? 1 : 0,
        proposalsCanceled: action === 'canceled' ? 1 : 0,
        lastActivityAt: new Date(),
      },
      update: {
        proposalsCreated: action === 'created' ? { increment: 1 } : undefined,
        proposalsExecuted: action === 'executed' ? { increment: 1 } : undefined,
        proposalsCanceled: action === 'canceled' ? { increment: 1 } : undefined,
        lastActivityAt: new Date(),
      },
    });

    return stats;
  }
}
