import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { QueryJobDto } from './dto/query-job.dto';

import { JobStatus } from '@prisma/client';

@Injectable()
export class JobsService {
  constructor(private prisma: PrismaService) {}

  /**
   * 创建 Job
   */
  async create(userId: number, dto: CreateJobDto) {
    const job = await this.prisma.job.create({
      data: {
        title: dto.title,
        description: dto.description,
        category: dto.category,
        tags: dto.tags || [],
        requiredCapabilities: dto.requiredCapabilities,
        inputData: dto.inputData,
        expectedOutput: dto.expectedOutput || null,
        budget: dto.budget,
        currency: dto.currency || 'ETH',
        escrowAmount: dto.budget, // 与 budget 相同
        deadline: dto.deadline ? new Date(dto.deadline) : null,
        estimatedDuration: dto.estimatedDuration || null,
        matchingMode: dto.matchingMode || 'SMART',
        ownerId: userId,
        // 🆕 竞价模式字段
        competitionMode: dto.competitionMode || false,
        competitorCount: dto.competitorCount || 3,
        // 链上字段
        chainJobId: dto.chainJobId || null,
        chainTxHash: dto.chainTxHash || null,
        chainDeadline: dto.chainDeadline || null,
      },
      include: {
        owner: {
          select: {
            id: true,
            walletAddress: true,
            name: true,
          },
        },
      },
    });

    return job;
  }

  /**
   * 查询 Jobs 列表（分页、筛选、排序）
   */
  async findAll(query: QueryJobDto) {
    const {
      page = 1,
      limit = 20,
      category,
      status, // 移除默认值 JobStatus.OPEN
      search,
      sortBy = 'createdAt',
      order = 'desc',
    } = query;

    const skip = (page - 1) * limit;

    // 构建查询条件
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (category) {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // 查询数据
    const [data, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: order },
        include: {
          owner: {
            select: { id: true, walletAddress: true, name: true },
          },
          assignedAgent: {
            select: {
              id: true,
              name: true,
              rating: true,
              avatar: true,
            },
          },
        },
      }),
      this.prisma.job.count({ where }),
    ]);

    return {
      data: data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 获取 Job 详情
   */
  async findOne(id: number) {
    const job = await this.prisma.job.findUnique({
      where: { id },
      include: {
        owner: {
          select: { id: true, walletAddress: true, name: true },
        },
        assignedAgent: {
          include: {
            owner: {
              select: { id: true, walletAddress: true, name: true },
            },
          },
        },
        recommendations: {
          include: {
            agent: true,
          },
          orderBy: { matchScore: 'desc' },
          take: 5,
        },
      },
    });

    if (!job) {
      throw new NotFoundException(`Job with ID ${id} not found`);
    }

    // 转换 BigInt 为字符串
    return job;
  }

  /**
   * 更新 Job
   */
  async update(id: number, userId: number, dto: UpdateJobDto) {
    const job = await this.findOne(id);

    // 权限检查：只有 Job owner 可以更新
    if (job.ownerId !== userId) {
      throw new ForbiddenException('You can only update your own jobs');
    }

    // 不允许更新已开始或已完成的 Job
    if (['IN_PROGRESS', 'SUBMITTED', 'COMPLETED'].includes(job.status)) {
      throw new ForbiddenException('Cannot update job in current status');
    }

    return this.prisma.job.update({
      where: { id },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.description && { description: dto.description }),
        ...(dto.budget !== undefined && { budget: dto.budget }),
        ...(dto.tags && { tags: dto.tags }),
        ...(dto.deadline && { deadline: new Date(dto.deadline) }),
        ...(dto.expectedOutput !== undefined && {
          expectedOutput: dto.expectedOutput,
        }),
        ...(dto.assignedAgentId !== undefined && {
          assignedAgentId: dto.assignedAgentId,
        }),
        ...(dto.status && { status: dto.status }),
      },
      include: {
        owner: true,
        assignedAgent: true,
      },
    });
  }

  /**
   * 取消 Job
   */
  async cancel(id: number, userId: number) {
    const job = await this.findOne(id);

    if (job.ownerId !== userId) {
      throw new ForbiddenException('You can only cancel your own jobs');
    }

    if (job.status !== 'OPEN' && job.status !== 'MATCHED') {
      throw new ForbiddenException(
        'Can only cancel jobs in OPEN or MATCHED status',
      );
    }

    return this.prisma.job.update({
      where: { id },
      data: { status: JobStatus.CANCELLED },
    });
  }

  /**
   * 删除 Job
   */
  async remove(id: number, userId: number) {
    const job = await this.findOne(id);

    if (job.ownerId !== userId) {
      throw new ForbiddenException('You can only delete your own jobs');
    }

    await this.prisma.job.delete({
      where: { id },
    });

    return { message: 'Job deleted successfully' };
  }

  /**
   * 获取用户发布的 Jobs
   */
  async findPublishedJobs(userId: number, query: QueryJobDto) {
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
            select: { id: true, name: true, rating: true },
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

  /**
   * 获取分配给用户 Agents 的 Jobs
   */
  async findAssignedJobs(userId: number, query: QueryJobDto) {
    const {
      page = 1,
      limit = 20,
      status,
      sortBy = 'createdAt',
      order = 'desc',
    } = query;
    const skip = (page - 1) * limit;

    // 先查询用户的 Agents
    const userAgents = await this.prisma.agent.findMany({
      where: { ownerId: userId },
      select: { id: true },
    });

    const agentIds = userAgents.map((a) => a.id);

    const where: any = {
      assignedAgentId: { in: agentIds },
    };

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
          owner: {
            select: { id: true, walletAddress: true, name: true },
          },
          assignedAgent: true,
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

  /**
   * 获取 Jobs 统计数据
   */
  async getStats() {
    const [total, open, matched, inProgress, submitted, completed, cancelled] =
      await Promise.all([
        this.prisma.job.count(),
        this.prisma.job.count({ where: { status: JobStatus.OPEN } }),
        this.prisma.job.count({ where: { status: JobStatus.MATCHED } }),
        this.prisma.job.count({ where: { status: JobStatus.IN_PROGRESS } }),
        this.prisma.job.count({ where: { status: JobStatus.SUBMITTED } }),
        this.prisma.job.count({ where: { status: JobStatus.COMPLETED } }),
        this.prisma.job.count({ where: { status: JobStatus.CANCELLED } }),
      ]);

    return {
      total,
      open,
      matched,
      inProgress,
      submitted,
      completed,
      cancelled,
    };
  }
}
