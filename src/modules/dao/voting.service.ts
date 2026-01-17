import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateVoteDto } from './dto/vote.dto';
import { QueryVotesDto } from './dto/query-votes.dto';
import { VoteEntity } from './entities/vote.entity';
import { ActivityType, VoteType } from '@prisma/client';

/**
 * Voting Service
 * Handles vote recording and querying
 */
@Injectable()
export class VotingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new vote record
   */
  async create(createVoteDto: CreateVoteDto): Promise<VoteEntity> {
    const { votingPower, blockNumber, ...rest } = createVoteDto;

    // Check if vote already exists
    const existingVote = await this.prisma.vote.findUnique({
      where: {
        proposalId_voter: {
          proposalId: createVoteDto.proposalId,
          voter: createVoteDto.voter.toLowerCase(),
        },
      },
    });

    if (existingVote) {
      throw new ConflictException('User has already voted on this proposal');
    }

    // Check if proposal exists
    const proposal = await this.prisma.proposal.findUnique({
      where: { id: createVoteDto.proposalId },
    });

    if (!proposal) {
      throw new NotFoundException(`Proposal #${createVoteDto.proposalId} not found`);
    }

    // Create vote
    const vote = await this.prisma.vote.create({
      data: {
        ...rest,
        voter: rest.voter.toLowerCase(),
        votingPower: BigInt(votingPower),
        blockNumber: BigInt(blockNumber),
      },
    });

    // Update proposal vote counts
    const voteUpdate: any = {};
    if (vote.support === VoteType.FOR) {
      voteUpdate.votesFor = { increment: vote.votingPower };
    } else if (vote.support === VoteType.AGAINST) {
      voteUpdate.votesAgainst = { increment: vote.votingPower };
    } else if (vote.support === VoteType.ABSTAIN) {
      voteUpdate.votesAbstain = { increment: vote.votingPower };
    }

    await this.prisma.proposal.update({
      where: { id: vote.proposalId },
      data: voteUpdate,
    });

    // Create governance activity
    await this.prisma.governanceActivity.create({
      data: {
        activityType: ActivityType.VOTE_CAST,
        walletAddress: vote.voter,
        proposalId: vote.proposalId,
        voteId: vote.id,
        description: `Voted ${vote.support} on proposal`,
        metadata: JSON.stringify({ votingPower: vote.votingPower.toString() }),
        transactionHash: vote.transactionHash,
        blockNumber: vote.blockNumber,
      },
    });

    // Update voter stats
    await this.updateVoterStats(vote.voter, vote.support);

    return new VoteEntity(vote);
  }

  /**
   * Get votes for a specific wallet address
   */
  async findByWallet(walletAddress: string, query: QueryVotesDto) {
    const { support, page = 1, limit = 10, sortOrder = 'desc' } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      voter: walletAddress.toLowerCase(),
    };

    if (support) {
      where.support = support;
    }

    const [votes, total] = await Promise.all([
      this.prisma.vote.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: sortOrder },
        include: {
          proposal: {
            select: {
              id: true,
              title: true,
              status: true,
              proposer: true,
            },
          },
        },
      }),
      this.prisma.vote.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: votes.map((v) => new VoteEntity(v)),
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
   * Get a specific vote
   */
  async findOne(proposalId: string, voter: string): Promise<VoteEntity | null> {
    const vote = await this.prisma.vote.findUnique({
      where: {
        proposalId_voter: {
          proposalId,
          voter: voter.toLowerCase(),
        },
      },
    });

    if (!vote) {
      return null;
    }

    return new VoteEntity(vote);
  }

  /**
   * Check if user has voted on a proposal
   */
  async hasVoted(proposalId: string, voter: string): Promise<boolean> {
    const vote = await this.prisma.vote.findUnique({
      where: {
        proposalId_voter: {
          proposalId,
          voter: voter.toLowerCase(),
        },
      },
    });

    return !!vote;
  }

  /**
   * Get vote statistics for a proposal
   */
  async getProposalVoteStats(proposalId: string) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id: proposalId },
      select: {
        votesFor: true,
        votesAgainst: true,
        votesAbstain: true,
        _count: {
          select: {
            votes: true,
          },
        },
      },
    });

    if (!proposal) {
      throw new NotFoundException(`Proposal #${proposalId} not found`);
    }

    const totalVotingPower = proposal.votesFor + proposal.votesAgainst + proposal.votesAbstain;

    return {
      votesFor: proposal.votesFor.toString(),
      votesAgainst: proposal.votesAgainst.toString(),
      votesAbstain: proposal.votesAbstain.toString(),
      totalVotingPower: totalVotingPower.toString(),
      totalVoters: proposal._count.votes,
      forPercentage: totalVotingPower > 0n ? Number((proposal.votesFor * 10000n) / totalVotingPower) / 100 : 0,
      againstPercentage: totalVotingPower > 0n ? Number((proposal.votesAgainst * 10000n) / totalVotingPower) / 100 : 0,
      abstainPercentage: totalVotingPower > 0n ? Number((proposal.votesAbstain * 10000n) / totalVotingPower) / 100 : 0,
    };
  }

  /**
   * Update voter statistics
   */
  private async updateVoterStats(walletAddress: string, voteType: VoteType) {
    const updateData: any = {
      totalVotes: { increment: 1 },
      lastActivityAt: new Date(),
    };

    if (voteType === VoteType.FOR) {
      updateData.votesFor = { increment: 1 };
    } else if (voteType === VoteType.AGAINST) {
      updateData.votesAgainst = { increment: 1 };
    } else if (voteType === VoteType.ABSTAIN) {
      updateData.votesAbstain = { increment: 1 };
    }

    await this.prisma.governanceStats.upsert({
      where: { walletAddress: walletAddress.toLowerCase() },
      create: {
        walletAddress: walletAddress.toLowerCase(),
        totalVotes: 1,
        votesFor: voteType === VoteType.FOR ? 1 : 0,
        votesAgainst: voteType === VoteType.AGAINST ? 1 : 0,
        votesAbstain: voteType === VoteType.ABSTAIN ? 1 : 0,
        lastActivityAt: new Date(),
      },
      update: updateData,
    });
  }
}
