import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateJobApplicationDto,
  UpdateJobApplicationDto,
  QueryJobApplicationDto,
} from './dto/job-application.dto';

@Injectable()
export class JobApplicationService {
  constructor(private prisma: PrismaService) {}

  /**
   * Agent 申请 Job
   */
  async applyToJob(
    jobId: number,
    agentId: number,
    userId: number,
    dto: CreateJobApplicationDto,
  ) {
    // 验证 Job 是否存在
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    // 验证 Job 状态
    if (job.status !== 'OPEN') {
      throw new BadRequestException('Job is not open for applications');
    }

    // 验证 Agent 是否存在且属于当前用户
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    if (agent.ownerId !== userId) {
      throw new ForbiddenException('You can only apply with your own agents');
    }

    // 检查是否已申请
    const existing = await this.prisma.jobApplication.findUnique({
      where: {
        jobId_agentId: {
          jobId,
          agentId,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('You have already applied to this job');
    }

    // 创建申请
    const application = await this.prisma.jobApplication.create({
      data: {
        jobId,
        agentId,
        message: dto.message,
        proposedPrice: dto.proposedPrice,
        estimatedTime: dto.estimatedTime,
        status: 'PENDING',
      },
      include: {
        agent: {
          include: {
            owner: {
              select: {
                id: true,
                walletAddress: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return application;
  }

  /**
   * 获取 Job 的所有申请
   */
  async getJobApplications(
    jobId: number,
    userId: number,
    query: QueryJobApplicationDto,
  ) {
    // 验证 Job 是否存在且属于当前用户
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.ownerId !== userId) {
      throw new ForbiddenException(
        'You can only view applications for your own jobs',
      );
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { jobId };
    if (query.status) {
      where.status = query.status;
    }

    const [applications, total] = await Promise.all([
      this.prisma.jobApplication.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          agent: {
            include: {
              owner: {
                select: {
                  id: true,
                  walletAddress: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.jobApplication.count({ where }),
    ]);

    return {
      data: applications,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 获取我的 Agent 的所有申请
   */
  async getMyApplications(userId: number, query: QueryJobApplicationDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    // 获取用户的所有 Agents
    const agents = await this.prisma.agent.findMany({
      where: { ownerId: userId },
      select: { id: true },
    });

    const agentIds = agents.map((a) => a.id);

    const where: any = {
      agentId: { in: agentIds },
    };
    if (query.status) {
      where.status = query.status;
    }

    const [applications, total] = await Promise.all([
      this.prisma.jobApplication.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          job: {
            include: {
              owner: {
                select: {
                  id: true,
                  walletAddress: true,
                  name: true,
                },
              },
            },
          },
          agent: true,
        },
      }),
      this.prisma.jobApplication.count({ where }),
    ]);

    return {
      data: applications,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 更新申请状态（接受/拒绝）
   */
  async updateApplicationStatus(
    applicationId: number,
    userId: number,
    dto: UpdateJobApplicationDto,
  ) {
    // 获取申请
    const application = await this.prisma.jobApplication.findUnique({
      where: { id: applicationId },
      include: {
        job: true,
        agent: true,
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    // 验证权限（只有 Job owner 可以更新）
    if (application.job.ownerId !== userId) {
      throw new ForbiddenException(
        'Only job owner can update application status',
      );
    }

    // 验证状态
    if (application.status !== 'PENDING') {
      throw new BadRequestException('Application has already been processed');
    }

    // 更新申请状态
    const updated = await this.prisma.jobApplication.update({
      where: { id: applicationId },
      data: { status: dto.status },
      include: {
        agent: {
          include: {
            owner: {
              select: {
                id: true,
                walletAddress: true,
                name: true,
              },
            },
          },
        },
      },
    });

    // 如果接受申请，更新 Job 的 assignedAgentId
    if (dto.status === 'ACCEPTED') {
      await this.prisma.job.update({
        where: { id: application.jobId },
        data: {
          assignedAgentId: application.agentId,
          status: 'MATCHED',
        },
      });

      // 拒绝其他待处理的申请
      await this.prisma.jobApplication.updateMany({
        where: {
          jobId: application.jobId,
          id: { not: applicationId },
          status: 'PENDING',
        },
        data: { status: 'REJECTED' },
      });
    }

    return updated;
  }

  /**
   * 撤回申请
   */
  async withdrawApplication(applicationId: number, userId: number) {
    const application = await this.prisma.jobApplication.findUnique({
      where: { id: applicationId },
      include: { agent: true },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    // 验证权限
    if (application.agent.ownerId !== userId) {
      throw new ForbiddenException(
        'You can only withdraw your own applications',
      );
    }

    // 只能撤回 PENDING 状态的申请
    if (application.status !== 'PENDING') {
      throw new BadRequestException('Can only withdraw pending applications');
    }

    await this.prisma.jobApplication.delete({
      where: { id: applicationId },
    });

    return { message: 'Application withdrawn successfully' };
  }
}
