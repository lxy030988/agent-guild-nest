import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JobStatus } from '@prisma/client';
import { QueryJobDto } from '../jobs/dto/query-job.dto';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats(userId: number) {
    const activeContractStatuses = [
      JobStatus.MATCHED,
      JobStatus.IN_PROGRESS,
      JobStatus.SUBMITTED,
    ];
    const completedStatuses = [
      JobStatus.COMPLETED,
      JobStatus.RESOLVED_COMPLETED,
    ];

    const userJobsFilter = {
      OR: [
        { ownerId: userId },
        { assignedAgent: { ownerId: userId } },
      ],
    };

    const [
      publishedAgents,
      activeContracts,
      completedJobs,
      inProgressJobs,
      disputes,
      earningsAggregate,
    ] = await Promise.all([
      this.prisma.agent.count({
        where: { ownerId: userId },
      }),
      this.prisma.job.count({
        where: {
          ...userJobsFilter,
          status: { in: activeContractStatuses },
        },
      }),
      this.prisma.job.count({
        where: {
          ...userJobsFilter,
          status: { in: completedStatuses },
        },
      }),
      this.prisma.job.count({
        where: {
          ...userJobsFilter,
          status: JobStatus.IN_PROGRESS,
        },
      }),
      this.prisma.job.count({
        where: {
          ...userJobsFilter,
          status: JobStatus.DISPUTED,
        },
      }),
      this.prisma.job.aggregate({
        where: {
          assignedAgent: { ownerId: userId },
          status: { in: completedStatuses },
        },
        _sum: { budget: true },
      }),
    ]);

    const totalEarnings = earningsAggregate._sum.budget
      ? earningsAggregate._sum.budget.toString()
      : '0';

    return {
      publishedAgents,
      activeContracts,
      completedJobs,
      totalEarnings,
      inProgressJobs,
      disputes,
    };
  }

  async getSummary(userId: number, query: QueryJobDto) {
    const {
      page = 1,
      limit = 20,
      status,
      sortBy = 'createdAt',
      order = 'desc',
    } = query;
    const skip = (page - 1) * limit;

    const where: any = { ownerId: userId };
    if (status) {
      where.status = status;
    }

    const [data, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: order },
        include: {
          assignedAgent: {
            select: { id: true, name: true, rating: true, avatar: true },
          },
        },
      }),
      this.prisma.job.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getTabs(userId: number) {
    const [myPublishedJobs, myPublishedAgents, signedAgents, disputedAgents] =
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
            status: JobStatus.DISPUTED,
            assignedAgentId: { not: null },
          },
          _count: { _all: true },
        }),
      ]);

    return {
      myPublishedJobs,
      myPublishedAgents,
      signedAgents: signedAgents.length,
      disputedAgents: disputedAgents.length,
    };
  }

  async getSignedAgents(userId: number) {
    const groups = await this.prisma.job.groupBy({
      by: ['assignedAgentId'],
      where: {
        ownerId: userId,
        assignedAgentId: { not: null },
      },
      _count: { _all: true },
    });

    const agentCounts = groups
      .filter((group) => group.assignedAgentId !== null)
      .map((group) => ({
        id: group.assignedAgentId as number,
        assignedJobs: group._count._all,
      }))
      .sort((a, b) => b.assignedJobs - a.assignedJobs);

    if (agentCounts.length === 0) {
      return { data: [] };
    }

    const agents = await this.prisma.agent.findMany({
      where: { id: { in: agentCounts.map((item) => item.id) } },
      select: { id: true, name: true, avatar: true, rating: true, jobCount: true },
    });

    const agentMap = new Map(agents.map((agent) => [agent.id, agent]));

    const data = agentCounts
      .map((item) => {
        const agent = agentMap.get(item.id);
        if (!agent) {
          return null;
        }
        return {
          ...agent,
          assignedJobs: item.assignedJobs,
        };
      })
      .filter(Boolean);

    return { data };
  }
}
