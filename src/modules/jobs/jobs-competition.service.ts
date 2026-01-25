import {
  Injectable,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ExecutionStatus } from '@prisma/client';

@Injectable()
export class JobsCompetitionService {
  constructor(private prisma: PrismaService) {}

  /**
   * 获取竞价执行列表
   */
  async getCompetitionResults(jobId: number) {
    return this.prisma.jobExecution.findMany({
      where: { jobId },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            avatar: true,
            rating: true,
            competitionsWon: true,
            competitionsTotal: true,
            owner: { select: { walletAddress: true, name: true } },
          },
        },
      },
      orderBy: { qualityScore: 'desc' },
    });
  }

  /**
   * 自动评分（简单规则）
   */
  async autoScoreExecution(executionId: number) {
    const execution = await this.prisma.jobExecution.findUnique({
      where: { id: executionId },
      include: { job: true, agent: true },
    });

    if (!execution || !execution.resultData) return null;

    // 简单评分逻辑（可扩展）
    let score = 50; // 基础分

    // 1. 完成速度
    if (execution.completedAt && execution.startedAt) {
      const duration =
        execution.completedAt.getTime() - execution.startedAt.getTime();
      const minutes = duration / 1000 / 60;
      if (minutes < 5) score += 20;
      else if (minutes < 10) score += 10;
    }

    // 2. Agent 历史评分
    if (execution.agent.rating) {
      score += execution.agent.rating * 6; // 5星最多加30分
    }

    // 3. 结果长度（简单启发式）
    const resultText = JSON.stringify(execution.resultData);
    if (resultText.length > 500) score += 10;

    const finalScore = Math.min(score, 100);

    await this.prisma.jobExecution.update({
      where: { id: executionId },
      data: { autoScore: finalScore },
    });

    return finalScore;
  }

  /**
   * 人工评分
   */
  async manualScoreExecution(
    executionId: number,
    userId: number,
    score: number,
    reason?: string,
  ) {
    const execution = await this.prisma.jobExecution.findUnique({
      where: { id: executionId },
      include: { job: true },
    });

    if (!execution) {
      throw new Error('Execution not found');
    }

    if (execution.job.ownerId !== userId) {
      throw new ForbiddenException('Only job owner can score');
    }

    // 计算最终分数：人工 70% + 自动 30%
    const finalScore = score * 0.7 + (execution.autoScore || 0) * 0.3;

    return this.prisma.jobExecution.update({
      where: { id: executionId },
      data: {
        manualScore: score,
        qualityScore: finalScore,
        scoringReason: reason,
        status: ExecutionStatus.COMPLETED,
      },
    });
  }

  /**
   * 选择胜出者
   */
  async selectWinner(jobId: number, executionId: number, userId: number) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: { executions: true },
    });

    if (!job) {
      throw new Error('Job not found');
    }

    if (job.ownerId !== userId) {
      throw new ForbiddenException('Only job owner can select winner');
    }

    const execution = job.executions.find((e) => e.id === executionId);
    if (!execution) {
      throw new Error('Execution not found');
    }

    // 更新 Job：标记胜出者，并分配 Agent，状态变为 SUBMITTED
    await this.prisma.job.update({
      where: { id: jobId },
      data: {
        winnerExecutionId: executionId,
        assignedAgentId: execution.agentId, // 🆕 更新分配的 Agent
        status: 'SUBMITTED', // 选择胜出者后，等待 Job Owner 点击"完成"
      },
    });

    // 标记胜出者
    await this.prisma.jobExecution.update({
      where: { id: executionId },
      data: { isWinner: true },
    });

    console.log(
      `✅ Winner selected for Job ${jobId}: Execution ${executionId}`,
    );

    return execution;
  }

  /**
   * 完成竞价任务（支付给胜出 Agent）
   * 在 jobs-execution.service.ts 的 approveJob 中调用
   */
  async finalizeCompetition(jobId: number) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        winnerExecution: { include: { agent: true } },
        executions: true,
      },
    });

    if (!job || !job.winnerExecution) {
      throw new Error('Winner not selected');
    }

    // 更新 Agent 统计
    await this.prisma.agent.update({
      where: { id: job.winnerExecution.agentId },
      data: {
        competitionsWon: { increment: 1 },
        competitionsTotal: { increment: 1 },
      },
    });

    // 更新其他参与者统计
    for (const ex of job.executions) {
      if (ex.id !== job.winnerExecutionId) {
        await this.prisma.agent.update({
          where: { id: ex.agentId },
          data: { competitionsTotal: { increment: 1 } },
        });
      }
    }

    console.log(`✅ Competition finalized for Job ${jobId}`);
  }
}
