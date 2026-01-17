import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GovernanceStatsEntity } from './entities/governance-stats.entity';
import { GovernanceActivityEntity } from './entities/governance-activity.entity';

/**
 * Governance Stats Service
 * Handles user governance statistics and activity tracking
 */
@Injectable()
export class GovernanceStatsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get governance stats for a wallet address
   */
  async getStats(walletAddress: string): Promise<GovernanceStatsEntity> {
    const stats = await this.prisma.governanceStats.findUnique({
      where: { walletAddress: walletAddress.toLowerCase() },
    });

    if (!stats) {
      // Return default stats if not found
      return new GovernanceStatsEntity({
        id: '',
        walletAddress: walletAddress.toLowerCase(),
        proposalsCreated: 0,
        proposalsExecuted: 0,
        proposalsCanceled: 0,
        totalVotes: 0,
        votesFor: 0,
        votesAgainst: 0,
        votesAbstain: 0,
        totalStaked: 0n,
        currentStaked: 0n,
        totalVotingPower: 0n,
        lastActivityAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return new GovernanceStatsEntity(stats);
  }

  /**
   * Get overall governance statistics
   */
  async getOverallStats() {
    const [
      totalProposals,
      activeProposals,
      totalVotes,
      totalStakers,
      totalVotingPower,
      recentActivity,
    ] = await Promise.all([
      this.prisma.proposal.count(),
      this.prisma.proposal.count({ where: { status: 'ACTIVE' } }),
      this.prisma.vote.count(),
      this.prisma.governanceStats.count({
        where: { currentStaked: { gt: 0 } },
      }),
      this.prisma.governanceStats.aggregate({
        _sum: { totalVotingPower: true },
      }),
      this.prisma.governanceActivity.findMany({
        take: 10,
        orderBy: { timestamp: 'desc' },
      }),
    ]);

    // Get top proposers
    const topProposers = await this.prisma.governanceStats.findMany({
      where: { proposalsCreated: { gt: 0 } },
      orderBy: { proposalsCreated: 'desc' },
      take: 10,
      select: {
        walletAddress: true,
        proposalsCreated: true,
        proposalsExecuted: true,
      },
    });

    // Get top voters
    const topVoters = await this.prisma.governanceStats.findMany({
      where: { totalVotes: { gt: 0 } },
      orderBy: { totalVotes: 'desc' },
      take: 10,
      select: {
        walletAddress: true,
        totalVotes: true,
        votesFor: true,
        votesAgainst: true,
        votesAbstain: true,
      },
    });

    // Get top stakers
    const topStakers = await this.prisma.governanceStats.findMany({
      where: { currentStaked: { gt: 0 } },
      orderBy: { currentStaked: 'desc' },
      take: 10,
      select: {
        walletAddress: true,
        currentStaked: true,
        totalVotingPower: true,
      },
    });

    return {
      proposals: {
        total: totalProposals,
        active: activeProposals,
      },
      votes: {
        total: totalVotes,
      },
      staking: {
        totalStakers,
        totalVotingPower: totalVotingPower._sum.totalVotingPower?.toString() || '0',
      },
      leaderboards: {
        topProposers: topProposers.map((p) => ({
          walletAddress: p.walletAddress,
          proposalsCreated: p.proposalsCreated,
          proposalsExecuted: p.proposalsExecuted,
        })),
        topVoters: topVoters.map((v) => ({
          walletAddress: v.walletAddress,
          totalVotes: v.totalVotes,
          votesFor: v.votesFor,
          votesAgainst: v.votesAgainst,
          votesAbstain: v.votesAbstain,
        })),
        topStakers: topStakers.map((s) => ({
          walletAddress: s.walletAddress,
          currentStaked: s.currentStaked.toString(),
          totalVotingPower: s.totalVotingPower.toString(),
        })),
      },
      recentActivity: recentActivity.map((a) => new GovernanceActivityEntity(a)),
    };
  }

  /**
   * Get user activity feed
   */
  async getUserActivity(walletAddress: string, limit = 20): Promise<GovernanceActivityEntity[]> {
    const activities = await this.prisma.governanceActivity.findMany({
      where: { walletAddress: walletAddress.toLowerCase() },
      take: limit,
      orderBy: { timestamp: 'desc' },
    });

    return activities.map((activity) => new GovernanceActivityEntity(activity));
  }

  /**
   * Get recent governance activities (global feed)
   */
  async getRecentActivity(limit = 50): Promise<GovernanceActivityEntity[]> {
    const activities = await this.prisma.governanceActivity.findMany({
      take: limit,
      orderBy: { timestamp: 'desc' },
    });

    return activities.map((activity) => new GovernanceActivityEntity(activity));
  }

  /**
   * Get participation rate for a user
   */
  async getParticipationRate(walletAddress: string): Promise<{
    totalProposals: number;
    votedProposals: number;
    participationRate: number;
  }> {
    const totalProposals = await this.prisma.proposal.count({
      where: {
        status: { in: ['ACTIVE', 'SUCCEEDED', 'DEFEATED', 'EXECUTED'] },
      },
    });

    const votedProposals = await this.prisma.vote.count({
      where: { voter: walletAddress.toLowerCase() },
    });

    const participationRate = totalProposals > 0 ? (votedProposals / totalProposals) * 100 : 0;

    return {
      totalProposals,
      votedProposals,
      participationRate: Math.round(participationRate * 100) / 100,
    };
  }

  /**
   * Recalculate voting power for a user
   */
  async recalculateVotingPower(walletAddress: string): Promise<void> {
    const stakes = await this.prisma.stake.findMany({
      where: {
        walletAddress: walletAddress.toLowerCase(),
        withdrawn: false,
      },
    });

    let totalVotingPower = 0n;

    for (const stake of stakes) {
      totalVotingPower += BigInt(Math.floor(Number(stake.amount) * stake.multiplier));
    }

    await this.prisma.governanceStats.upsert({
      where: { walletAddress: walletAddress.toLowerCase() },
      create: {
        walletAddress: walletAddress.toLowerCase(),
        totalVotingPower,
      },
      update: {
        totalVotingPower,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Get voting history summary for a user
   */
  async getVotingHistory(walletAddress: string) {
    const votes = await this.prisma.vote.findMany({
      where: { voter: walletAddress.toLowerCase() },
      include: {
        proposal: {
          select: {
            id: true,
            title: true,
            status: true,
            executed: true,
          },
        },
      },
      orderBy: { timestamp: 'desc' },
    });

    // Calculate success rate (voted FOR on executed proposals)
    const votesOnExecutedProposals = votes.filter((v) => v.proposal.executed);
    const successfulVotes = votesOnExecutedProposals.filter(
      (v) => v.support === 'FOR' && v.proposal.status === 'EXECUTED',
    );

    const successRate =
      votesOnExecutedProposals.length > 0
        ? (successfulVotes.length / votesOnExecutedProposals.length) * 100
        : 0;

    return {
      totalVotes: votes.length,
      votesOnExecutedProposals: votesOnExecutedProposals.length,
      successfulVotes: successfulVotes.length,
      successRate: Math.round(successRate * 100) / 100,
      recentVotes: votes.slice(0, 10).map((v) => ({
        proposalId: v.proposalId,
        proposalTitle: v.proposal.title,
        support: v.support,
        votingPower: v.votingPower.toString(),
        timestamp: v.timestamp,
        proposalStatus: v.proposal.status,
      })),
    };
  }
}
