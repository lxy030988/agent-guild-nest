import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { SubmitVoteDto } from './dto/submit-vote.dto';
import { DisputeStatus, VoteChoice, Prisma, JobStatus } from '@prisma/client';

@Injectable()
export class DisputesService {
  constructor(private prisma: PrismaService) {}

  /**
   * 创建争议
   */
  async createDispute(userId: number, createDisputeDto: CreateDisputeDto) {
    const { jobId, title, reason, evidence } = createDisputeDto;

    // 检查任务是否存在
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: { owner: true, assignedAgent: true },
    });

    if (!job) {
      throw new NotFoundException('任务不存在');
    }

    // 检查任务状态（只有已完成或已提交的任务才能发起争议）
    if (job.status !== 'COMPLETED' && job.status !== 'SUBMITTED') {
      throw new BadRequestException('只能对已完成或已提交的任务发起争议');
    }

    // 检查用户是否有权限发起争议（任务发布者或被分配的 Agent）
    const isJobOwner = job.ownerId === userId;
    const isAssignedAgent =
      job.assignedAgentId && job.assignedAgent?.ownerId === userId;

    if (!isJobOwner && !isAssignedAgent) {
      throw new ForbiddenException(
        '只有任务发布者或被分配的 Agent 可以发起争议',
      );
    }

    // 检查是否已存在未解决的争议
    const existingDispute = await this.prisma.dispute.findFirst({
      where: {
        jobId,
        status: { in: [DisputeStatus.PENDING, DisputeStatus.VOTING] },
      },
    });

    if (existingDispute) {
      throw new BadRequestException('该任务已存在未解决的争议');
    }

    // 创建争议 - 投票期默认 7 天，如果传入了时间则使用传入的时间
    const votingStartsAt = new Date();
    const votingEndsAt = createDisputeDto.votingEndsAt
      ? new Date(createDisputeDto.votingEndsAt)
      : new Date();

    if (!createDisputeDto.votingEndsAt) {
      votingEndsAt.setDate(votingEndsAt.getDate() + 7);
    }

    const [dispute] = await this.prisma.$transaction([
      this.prisma.dispute.create({
        data: {
          jobId,
          creatorId: userId,
          title,
          reason,
          evidence,
          status: DisputeStatus.VOTING,
          votingStartsAt,
          votingEndsAt,
          chainDisputeId: createDisputeDto.chainDisputeId,
        },
      }),
      this.prisma.job.update({
        where: { id: jobId },
        data: { status: 'DISPUTED', feedback: reason },
      }),
    ]);

    const fullDispute = await this.prisma.dispute.findUnique({
      where: { id: dispute.id },
      include: {
        job: true,
        creator: true,
      },
    });

    return fullDispute;
  }

  /**
   * 获取争议列表
   */
  async listDisputes(filter?: { status?: DisputeStatus }) {
    const where: Prisma.DisputeWhereInput = {};

    if (filter?.status) {
      where.status = filter.status;
    }

    const disputes = await this.prisma.dispute.findMany({
      where,
      include: {
        job: {
          select: {
            id: true,
            title: true,
            budget: true,
            status: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            walletAddress: true,
          },
        },
        _count: {
          select: { votes: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return disputes;
  }

  /**
   * 获取争议详情
   */
  async getDisputeById(id: number) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id },
      include: {
        job: {
          include: {
            owner: { select: { id: true, name: true, walletAddress: true } },
            assignedAgent: {
              include: {
                owner: {
                  select: { id: true, name: true, walletAddress: true },
                },
              },
            },
          },
        },
        creator: {
          select: { id: true, name: true, walletAddress: true },
        },
        votes: {
          include: {
            voter: {
              select: { id: true, name: true, walletAddress: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!dispute) {
      throw new NotFoundException('争议不存在');
    }

    return dispute;
  }

  /**
   * 提交投票
   */
  async submitVote(
    disputeId: number,
    userId: number,
    submitVoteDto: SubmitVoteDto,
  ) {
    const { choice, reason, tokenWeight = '1' } = submitVoteDto;

    // 检查争议是否存在
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
    });

    if (!dispute) {
      throw new NotFoundException('争议不存在');
    }

    // 检查投票状态
    if (dispute.status !== DisputeStatus.VOTING) {
      throw new BadRequestException('该争议当前不接受投票');
    }

    // 检查投票期限
    if (dispute.votingEndsAt && new Date() > dispute.votingEndsAt) {
      throw new BadRequestException('投票期已结束');
    }

    // 检查是否已投票
    const existingVote = await this.prisma.vote.findUnique({
      where: {
        disputeId_voterId: {
          disputeId,
          voterId: userId,
        },
      },
    });

    if (existingVote) {
      throw new BadRequestException('您已经投过票了');
    }

    // 创建投票记录并更新争议统计
    const vote = await this.prisma.$transaction(async (tx) => {
      // 创建投票
      const newVote = await tx.vote.create({
        data: {
          disputeId,
          voterId: userId,
          choice,
          reason,
          tokenWeight,
        },
        include: {
          voter: {
            select: { id: true, name: true, walletAddress: true },
          },
        },
      });

      // 更新争议统计
      const updateData: Prisma.DisputeUpdateInput = {};
      if (choice === VoteChoice.APPROVE) {
        updateData.approveVotes = { increment: 1 };
      } else if (choice === VoteChoice.REJECT) {
        updateData.rejectVotes = { increment: 1 };
      } else if (choice === VoteChoice.ABSTAIN) {
        updateData.abstainVotes = { increment: 1 };
      }

      // 更新总投票权重
      const currentWeight = BigInt(dispute.totalVoteWeight || '0');
      const voteWeight = BigInt(tokenWeight);
      updateData.totalVoteWeight = (currentWeight + voteWeight).toString();

      await tx.dispute.update({
        where: { id: disputeId },
        data: updateData,
      });

      return newVote;
    });

    return vote;
  }

  /**
   * 解决争议（计算投票结果）
   */
  async resolveDispute(disputeId: number) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
    });

    if (!dispute) {
      throw new NotFoundException('争议不存在');
    }

    if (dispute.status !== DisputeStatus.VOTING) {
      throw new BadRequestException('该争议已解决或不在投票状态');
    }

    // 检查投票期是否已结束
    if (dispute.votingEndsAt && new Date() < dispute.votingEndsAt) {
      throw new BadRequestException('投票期尚未结束');
    }

    // 计算结果
    const { approveVotes, rejectVotes, abstainVotes } = dispute;
    let resolution: string;
    let finalStatus: DisputeStatus;
    let finalJobStatus: JobStatus;

    if (approveVotes > rejectVotes) {
      resolution = `争议已解决：支持方获胜（${approveVotes} 票 vs ${rejectVotes} 票）。认定工作成果有效。`;
      finalStatus = DisputeStatus.RESOLVED;
      finalJobStatus = JobStatus.RESOLVED_COMPLETED;
    } else if (rejectVotes > approveVotes) {
      resolution = `争议已解决：反对方获胜（${rejectVotes} 票 vs ${approveVotes} 票）。认定工作成果无效。`;
      finalStatus = DisputeStatus.RESOLVED;
      finalJobStatus = JobStatus.RESOLVED_CANCELLED;
    } else {
      resolution = `争议已解决：平局（${approveVotes} 票 vs ${rejectVotes} 票），弃权 ${abstainVotes} 票。各占 50%。`;
      finalStatus = DisputeStatus.RESOLVED;
      finalJobStatus = JobStatus.RESOLVED_COMPLETED; // 平局默认也标记为已解决支付（或可根据业务细化）
    }

    const updatedDispute = await this.prisma.$transaction(async (tx) => {
      // 1. 更新任务状态
      await tx.job.update({
        where: { id: dispute.jobId },
        data: { status: finalJobStatus },
      });

      // 2. 更新争议状态
      return tx.dispute.update({
        where: { id: disputeId },
        data: {
          status: finalStatus,
          resolution,
          resolvedAt: new Date(),
        },
        include: {
          job: true,
          creator: true,
          votes: {
            include: {
              voter: {
                select: { id: true, name: true, walletAddress: true },
              },
            },
          },
        },
      });
    });

    return updatedDispute;
  }

  /**
   * 获取用户的投票记录
   */
  async getMyVotes(userId: number) {
    const votes = await this.prisma.vote.findMany({
      where: { voterId: userId },
      include: {
        dispute: {
          include: {
            job: {
              select: { id: true, title: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return votes;
  }

  /**
   * 获取统计数据
   */
  async getStatistics() {
    const [total, voting, resolved] = await Promise.all([
      this.prisma.dispute.count(),
      this.prisma.dispute.count({
        where: { status: DisputeStatus.VOTING },
      }),
      this.prisma.dispute.count({
        where: { status: DisputeStatus.RESOLVED },
      }),
    ]);

    return {
      totalDisputes: total,
      activeVoting: voting,
      resolved,
    };
  }
}
