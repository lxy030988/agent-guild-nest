import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DashboardStatsDto,
  RevenueChartDataDto,
  JobsBreakdownDto,
  ActivityItemDto,
  ActivityListResponseDto,
} from './dto/dashboard.dto';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  /**
   * 获取用户的Dashboard统计数据
   */
  async getDashboardStats(userId: number): Promise<DashboardStatsDto> {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    // 并行查询所有统计数据
    const [
      publishedAgentsCount,
      publishedAgentsWeek,
      activeJobsCount,
      activeJobsWeek,
      completedJobsCount,
      completedJobsWeek,
      inProgressJobsCount,
      inProgressJobsWeek,
      totalEarnings,
      earningsWeekCount,
      disputesCount,
      disputesWeek,
    ] = await Promise.all([
      // 已发布Agent数量
      this.prisma.agent.count({
        where: { ownerId: userId },
      }),
      this.prisma.agent.count({
        where: { ownerId: userId, createdAt: { gte: weekAgo } },
      }),

      // 活跃任务数（OPEN + MATCHED + IN_PROGRESS）
      this.prisma.job.count({
        where: {
          ownerId: userId,
          status: { in: ['OPEN', 'MATCHED', 'IN_PROGRESS'] },
        },
      }),
      this.prisma.job.count({
        where: {
          ownerId: userId,
          status: { in: ['OPEN', 'MATCHED', 'IN_PROGRESS'] },
          createdAt: { gte: weekAgo },
        },
      }),

      // 已完成任务数
      this.prisma.job.count({
        where: {
          ownerId: userId,
          status: 'COMPLETED',
        },
      }),
      this.prisma.job.count({
        where: {
          ownerId: userId,
          status: 'COMPLETED',
          createdAt: { gte: weekAgo },
        },
      }),

      // 进行中任务数
      this.prisma.job.count({
        where: {
          ownerId: userId,
          status: 'IN_PROGRESS',
        },
      }),
      this.prisma.job.count({
        where: {
          ownerId: userId,
          status: 'IN_PROGRESS',
          createdAt: { gte: weekAgo },
        },
      }),

      // 总收益（从bills表汇总收入类账单）
      this.calculateTotalEarnings(userId),
      this.prisma.bill.count({
        where: {
          userId,
          type: 'INCOME',
          isPaid: true,
          createdAt: { gte: weekAgo },
        },
      }),

      // 争议数量（暂时返回0，后续可根据实际业务逻辑实现）
      this.getDisputesCount(userId),
      this.prisma.job.count({
        where: {
          ownerId: userId,
          status: 'DISPUTED',
          createdAt: { gte: weekAgo },
        },
      }),
    ]);

    return {
      publishedAgents: {
        value: publishedAgentsCount,
        note: publishedAgentsWeek,
      },
      activeJobs: {
        value: activeJobsCount,
        note: activeJobsWeek,
      },
      completedJobs: {
        value: completedJobsCount,
        note: completedJobsWeek,
      },
      totalEarnings: {
        value: totalEarnings.toString(),
        note: earningsWeekCount,
      },
      inProgressJobs: {
        value: inProgressJobsCount,
        note: inProgressJobsWeek,
      },
      disputes: {
        value: disputesCount,
        note: disputesWeek,
      },
    };
  }

  /**
   * 获取收益图表数据（最近N天）
   */
  async getRevenueChartData(
    userId: number,
    days: number = 30,
  ): Promise<RevenueChartDataDto[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 查询用户的收入类账单，按日期分组
    const bills = await this.prisma.bill.findMany({
      where: {
        userId,
        type: 'INCOME',
        createdAt: {
          gte: startDate,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // 按日期聚合
    const dailyRevenue = new Map<string, number>();

    // 初始化所有日期为0
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - i - 1));
      const dateStr = date.toISOString().split('T')[0];
      dailyRevenue.set(dateStr, 0);
    }

    // 累加收益
    for (const bill of bills) {
      const dateStr = bill.createdAt.toISOString().split('T')[0];
      const current = dailyRevenue.get(dateStr) || 0;
      // Prisma Decimal 需要转为字符串再解析
      const amount = parseFloat(bill.amount.toString());
      dailyRevenue.set(dateStr, current + amount);
    }

    // 转换为累计收益
    let cumulative = 0;
    const result: RevenueChartDataDto[] = [];

    for (const [date, amount] of Array.from(dailyRevenue.entries()).sort()) {
      cumulative += amount;
      result.push({
        date,
        amount: cumulative.toFixed(4),
      });
    }

    return result;
  }

  /**
   * 获取任务状态分布
   */
  async getJobsBreakdown(userId: number): Promise<JobsBreakdownDto> {
    // 查询用户所有任务并按状态分组统计
    const statusCounts = await this.prisma.job.groupBy({
      by: ['status'],
      where: { ownerId: userId },
      _count: { status: true },
    });

    const breakdown: JobsBreakdownDto = {
      open: 0,
      matched: 0,
      inProgress: 0,
      completed: 0,
      cancelled: 0,
    };

    for (const item of statusCounts) {
      const count = item._count.status;
      switch (item.status) {
        case 'OPEN':
          breakdown.open = count;
          break;
        case 'MATCHED':
          breakdown.matched = count;
          break;
        case 'IN_PROGRESS':
          breakdown.inProgress = count;
          break;
        case 'COMPLETED':
          breakdown.completed = count;
          break;
        case 'CANCELLED':
          breakdown.cancelled = count;
          break;
      }
    }

    return breakdown;
  }

  /**
   * 获取活动动态（可选实现）
   */
  async getActivityFeed(
    userId: number,
    page: number = 1,
    limit: number = 20,
  ): Promise<ActivityListResponseDto> {
    const skip = (page - 1) * limit;

    // 这里简化实现，只获取最近的Job活动
    // 实际项目中可以从多个表聚合活动数据
    const [jobs, total] = await Promise.all([
      this.prisma.job.findMany({
        where: { ownerId: userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.job.count({ where: { ownerId: userId } }),
    ]);

    const items: ActivityItemDto[] = jobs.map((job) => ({
      id: job.id,
      type: 'job' as const,
      action: this.getJobAction(job.status),
      description: `任务「${job.title}」${this.getJobStatusText(job.status)}`,
      relatedId: job.id,
      createdAt: job.updatedAt,
    }));

    return {
      items,
      total,
      page,
      limit,
    };
  }

  /**
   * 获取Dashboard Tabs统计数据
   */
  async loadTabCounts(userId: number) {
    const [publishedJobs, publishedAgents, signedAgents, disputedAgents] =
      await Promise.all([
        this.prisma.job.count({ where: { ownerId: userId } }),
        this.prisma.agent.count({ where: { ownerId: userId } }),
        this.prisma.job.groupBy({
          by: ['assignedAgentId'],
          where: {
            ownerId: userId,
            assignedAgentId: { not: null },
          },
          _count: { _all: true },
        }),
        this.prisma.job.groupBy({
          by: ['assignedAgentId'],
          where: {
            ownerId: userId,
            status: 'DISPUTED',
            assignedAgentId: { not: null },
          },
          _count: { _all: true },
        }),
      ]);

    return {
      publishedJobs,
      publishedAgents,
      signedAgents: signedAgents.length,
      disputedAgents: disputedAgents.length,
    };
  }

  async getSignedAgents(userId: number, page: number = 1, limit: number = 20) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const where = {
      ownerId: userId,
      assignedAgentId: { not: null },
    };

    const [jobs, signedAgents] = await Promise.all([
      this.prisma.job.findMany({
        where,
        distinct: ['assignedAgentId'],
        skip,
        take: safeLimit,
        orderBy: { updatedAt: 'desc' },
        include: {
          assignedAgent: {
            include: {
              owner: {
                select: { id: true, walletAddress: true, name: true },
              },
            },
          },
        },
      }),
      this.prisma.job.groupBy({
        by: ['assignedAgentId'],
        where,
        _count: { _all: true },
      }),
    ]);

    return {
      data: jobs.map((job) => job.assignedAgent).filter(Boolean),
      meta: {
        total: signedAgents.length,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.max(1, Math.ceil(signedAgents.length / safeLimit)),
      },
    };
  }

  /**
   * 计算总收益
   */
  private async calculateTotalEarnings(userId: number): Promise<number> {
    const result = await this.prisma.bill.aggregate({
      where: {
        userId,
        type: 'INCOME',
        isPaid: true,
      },
      _sum: {
        amount: true,
      },
    });

    // Prisma Decimal 需要先转为字符串再转为数字
    const sumAmount = result._sum.amount;
    if (!sumAmount) return 0;

    return parseFloat(sumAmount.toString());
  }

  /**
   * 获取争议数量
   */
  private async getDisputesCount(userId: number): Promise<number> {
    // 统计用户作为Owner的DISPUTED状态任务
    return this.prisma.job.count({
      where: {
        ownerId: userId,
        status: 'DISPUTED',
      },
    });
  }

  /**
   * 获取Job动作文本
   */
  private getJobAction(status: string): string {
    const actions: Record<string, string> = {
      OPEN: 'created',
      MATCHED: 'matched',
      IN_PROGRESS: 'started',
      SUBMITTED: 'submitted',
      COMPLETED: 'completed',
      CANCELLED: 'cancelled',
    };
    return actions[status] || 'updated';
  }

  /**
   * 获取Job状态中文文本
   */
  private getJobStatusText(status: string): string {
    const texts: Record<string, string> = {
      OPEN: '已发布',
      MATCHED: '已匹配',
      IN_PROGRESS: '进行中',
      SUBMITTED: '已提交',
      COMPLETED: '已完成',
      CANCELLED: '已取消',
    };
    return texts[status] || status;
  }
}
