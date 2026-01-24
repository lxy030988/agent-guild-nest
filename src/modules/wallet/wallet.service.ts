import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class WalletService {
  constructor(private prisma: PrismaService) {}

  /**
   * 获取钱包概览
   */
  async getWalletOverview(userId: number) {
    // 获取用户已完成的 Agent 任务
    const completedJobs = await this.prisma.job.findMany({
      where: {
        assignedAgentId: {
          in: (
            await this.prisma.agent.findMany({
              where: { ownerId: userId },
              select: { id: true },
            })
          ).map((a) => a.id),
        },
        status: 'COMPLETED',
      },
      select: {
        rating: true,
        budget: true,
      },
    });

    const totalEarnings = completedJobs.reduce(
      (sum, job) => sum.add(job.budget.mul(0.95)), // 扣除 5% 平台费
      new Prisma.Decimal(0),
    );

    const totalJobs = completedJobs.length;
    const averageRating =
      totalJobs > 0
        ? completedJobs.reduce((sum, job) => sum + (job.rating || 0), 0) /
          totalJobs
        : 0;

    return {
      totalEarnings: totalEarnings.toString(),
      pendingEarnings: '0', // 待结算收益 (待实现)
      totalJobs,
      averageRating: averageRating.toFixed(2),
    };
  }

  /**
   * 获取收益统计（三个钱包）
   */
  async getEarnings(userId: number) {
    // Agent 收益
    const agentEarnings = await this.prisma.transaction.aggregate({
      where: {
        toUserId: userId,
        type: 'JOB_PAYMENT',
      },
      _sum: {
        amount: true,
      },
    });

    // Job 托管（用户作为 Job Owner 托管的资金）
    const jobEscrow = await this.prisma.job.aggregate({
      where: {
        ownerId: userId,
        status: {
          in: ['OPEN', 'MATCHED', 'IN_PROGRESS', 'SUBMITTED'],
        },
      },
      _sum: {
        budget: true,
      },
    });

    // 质押奖励
    const stakingRewards = await this.prisma.transaction.aggregate({
      where: {
        toUserId: userId,
        type: 'STAKING_REWARD',
      },
      _sum: {
        amount: true,
      },
    });

    return {
      agentEarnings: (
        agentEarnings._sum.amount || new Prisma.Decimal(0)
      ).toString(),
      jobEscrow: (jobEscrow._sum.budget || new Prisma.Decimal(0)).toString(),
      stakingRewards: (
        stakingRewards._sum.amount || new Prisma.Decimal(0)
      ).toString(),
    };
  }

  /**
   * 获取交易历史
   */
  async getTransactionHistory(userId: number, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where: {
          OR: [{ fromUserId: userId }, { toUserId: userId }],
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          job: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      }),
      this.prisma.transaction.count({
        where: {
          OR: [{ fromUserId: userId }, { toUserId: userId }],
        },
      }),
    ]);

    return {
      items: items.map((t) => ({
        id: t.id,
        type: t.type,
        amount: t.amount.toString(),
        currency: t.currency,
        description: t.description || (t.job ? t.job.title : 'Unknown'),
        txHash: t.txHash,
        createdAt: t.createdAt,
      })),
      total,
      page,
      limit,
    };
  }

  /**
   * 获取资产趋势（最近 N 天）
   */
  async getAssetTrends(userId: number, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        toUserId: userId,
        type: 'JOB_PAYMENT',
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        amount: true,
        createdAt: true,
      },
    });

    // 按天聚合
    const trendsByDay: Record<string, Prisma.Decimal> = {};
    let cumulative = new Prisma.Decimal(0);

    transactions.forEach((t) => {
      const day = t.createdAt.toISOString().split('T')[0];
      cumulative = cumulative.add(t.amount);
      trendsByDay[day] = cumulative;
    });

    return Object.entries(trendsByDay).map(([date, amount]) => ({
      date,
      amount: amount.toString(),
    }));
  }
}
