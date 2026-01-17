import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Job, Agent } from '@prisma/client';

@Injectable()
export class JobsMatchingService {
  constructor(private prisma: PrismaService) {}

  /**
   * 智能匹配算法
   * 根据 capabilities、评分、成功率等因素计算匹配度
   */
  async findMatchingAgents(jobId: number, matchingMode: string = 'SMART') {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    // 1. 查询具有所需能力的 Agents
    const candidates = await this.prisma.agent.findMany({
      where: {
        status: 'ACTIVE',
        healthStatus: { in: ['HEALTHY', 'UNKNOWN'] },
        availability: true,
        capabilities: {
          hasSome: job.requiredCapabilities,
        },
      },
    });

    if (candidates.length === 0) {
      console.log(`[Job ${jobId}] No matching agents found`);
      return [];
    }

    // 2. 计算所有匹配分数（内存操作，快速）
    const matchData = candidates.map((agent) => {
      const score = this.calculateMatchScore(job, agent);
      return {
        jobId: job.id,
        agentId: agent.id,
        matchScore: score,
        reason: this.generateMatchReason(job, agent, score),
      };
    });

    // 3. 🚀 批量 upsert（单次事务，大幅减少数据库往返）
    await this.prisma.$transaction(
      matchData.map((match) =>
        this.prisma.jobAgentMatch.upsert({
          where: {
            jobId_agentId: {
              jobId: match.jobId,
              agentId: match.agentId,
            },
          },
          create: match,
          update: {
            matchScore: match.matchScore,
            reason: match.reason,
          },
        }),
      ),
    );

    console.log(
      `[Job ${jobId}] Created/updated ${matchData.length} agent matches`,
    );

    // 4. 排序并获取最佳匹配
    const sortedMatches = matchData.sort((a, b) => b.matchScore - a.matchScore);

    // 5. 只有 SMART 模式才自动分配最佳 Agent
    if (matchingMode === 'SMART' && sortedMatches.length > 0) {
      await this.prisma.job.update({
        where: { id: jobId },
        data: {
          assignedAgentId: sortedMatches[0].agentId,
          status: 'MATCHED',
        },
      });
      console.log(
        `[Job ${jobId}] Auto-assigned agent ${sortedMatches[0].agentId}`,
      );
    }

    return sortedMatches.slice(0, 5);
  }

  /**
   * 匹配分数计算
   * - 能力匹配度 40%
   * - 历史评分 30%
   * - 成功率 20%
   * - 响应时间 10%
   */
  private calculateMatchScore(job: Job, agent: Agent): number {
    let score = 0;

    // 能力匹配 (0-40分)
    const matchedCaps = job.requiredCapabilities.filter((cap) =>
      agent.capabilities.includes(cap),
    );
    const capabilityScore =
      (matchedCaps.length / job.requiredCapabilities.length) * 40;

    // 历史评分 (0-30分)
    const ratingScore = (agent.rating || 0) * 6; // 5星 = 30分

    // 成功率 (0-20分)
    // 简化版本：假设 jobCount > 10 的 Agent 成功率为 90%
    const hasExperience = agent.jobCount >= 10;
    const successScore = hasExperience ? 18 : agent.jobCount * 1.5;

    // 响应时间/健康状态 (0-10分)
    const healthScore = agent.healthStatus === 'HEALTHY' ? 10 : 5;

    score = capabilityScore + ratingScore + successScore + healthScore;

    return Math.min(Math.round(score), 100);
  }

  /**
   * 生成推荐理由
   */
  private generateMatchReason(job: Job, agent: Agent, score: number): string {
    const matchedCaps = job.requiredCapabilities.filter((cap) =>
      agent.capabilities.includes(cap),
    );

    if (score >= 80) {
      return `✨ 高度匹配：具备 ${matchedCaps.length}/${job.requiredCapabilities.length} 项能力，评分 ${agent.rating?.toFixed(1) || 'N/A'} ⭐，已完成 ${agent.jobCount} 个任务`;
    } else if (score >= 60) {
      return `👍 推荐：完成过 ${agent.jobCount} 个类似任务，能力部分匹配`;
    } else if (score >= 40) {
      return `💡 可考虑：部分匹配所需能力 (${matchedCaps.length}/${job.requiredCapabilities.length})`;
    } else {
      return `⚠️ 低匹配度：建议寻找更合适的 Agent`;
    }
  }

  /**
   * 获取 Job 的推荐 Agents
   * 如果没有推荐记录，自动生成
   */
  async getRecommendations(jobId: number) {
    // 1. 先查询现有推荐
    let matches = await this.prisma.jobAgentMatch.findMany({
      where: { jobId },
      include: {
        agent: {
          include: {
            owner: {
              select: { id: true, walletAddress: true, name: true },
            },
          },
        },
      },
      orderBy: { matchScore: 'desc' },
      take: 5,
    });

    // 2. 如果没有推荐记录，生成推荐（但不自动分配）
    if (matches.length === 0) {
      console.log(`[Job ${jobId}] No recommendations found, generating...`);

      // 使用 APPLICATION 模式：计算匹配但不自动分配
      await this.findMatchingAgents(jobId, 'APPLICATION');

      // 重新查询
      matches = await this.prisma.jobAgentMatch.findMany({
        where: { jobId },
        include: {
          agent: {
            include: {
              owner: {
                select: { id: true, walletAddress: true, name: true },
              },
            },
          },
        },
        orderBy: { matchScore: 'desc' },
        take: 5,
      });
    }

    return matches;
  }

  /**
   * 手动分配 Agent 到 Job
   */
  async assignAgent(jobId: number, agentId: number, userId: number) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new Error('Job not found');
    }

    if (job.ownerId !== userId) {
      throw new Error('Only job owner can assign agent');
    }

    if (job.status !== 'OPEN') {
      throw new Error('Job is not in OPEN status');
    }

    return this.prisma.job.update({
      where: { id: jobId },
      data: {
        assignedAgentId: agentId,
        status: 'MATCHED',
      },
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
      },
    });
  }
}
