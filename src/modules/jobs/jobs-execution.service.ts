import {
  Injectable,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JobStatus } from '@prisma/client';
import axios from 'axios';
import { BillsService } from '../bills/bills.service';
import { JobsCompetitionService } from './jobs-competition.service'; // 🆕 导入
import jwt from 'jsonwebtoken';

@Injectable()
export class JobsExecutionService {
  constructor(
    private prisma: PrismaService,
    private billsService: BillsService,
    @Inject(forwardRef(() => JobsCompetitionService)) // 🆕 使用 forwardRef 解决循环依赖
    private competitionService: JobsCompetitionService,
  ) {}

  /**
   * Agent 所有者接受任务
   */
  async acceptJob(jobId: number, userId: number) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: { assignedAgent: true },
    });

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (!job.assignedAgent) {
      throw new ForbiddenException('No agent assigned to this job');
    }

    // 验证是否为 Agent 的所有者
    const agent = await this.prisma.agent.findUnique({
      where: { id: job.assignedAgentId! },
    });

    if (!agent || agent.ownerId !== userId) {
      throw new ForbiddenException('Only the agent owner can accept this job');
    }

    // 更新状态为 MATCHED
    return this.prisma.job.update({
      where: { id: jobId },
      data: { status: JobStatus.MATCHED },
      include: { assignedAgent: true, owner: true },
    });
  }

  /**
   * 开始执行任务
   */
  async startJob(jobId: number, userId: number) {
    console.log(`[ENTRY] startJob called for Job ${jobId} by User ${userId}`);
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: { assignedAgent: true },
    });

    if (!job || !job.assignedAgent) {
      throw new Error('Job or agent not found');
    }

    const agent = await this.prisma.agent.findUnique({
      where: { id: job.assignedAgentId! },
    });

    if (!agent || agent.ownerId !== userId) {
      throw new ForbiddenException('Only the agent owner can start this job');
    }

    if (job.status !== JobStatus.MATCHED) {
      throw new ForbiddenException('Job must be in MATCHED status to start');
    }

    // 更新状态并调用 Agent API
    await this.prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.IN_PROGRESS,
        startedAt: new Date(),
      },
    });

    // 异步执行（不阻塞响应）
    this.executeJobAsync(jobId);

    return { message: 'Job execution started' };
  }

  /**
   * 🆕 启动竞价执行（并行）
   */
  async startCompetition(jobId: number, userId: number) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: { executions: { include: { agent: true } } },
    });

    if (!job || job.ownerId !== userId) {
      throw new ForbiddenException('Unauthorized');
    }

    if (!job.competitionMode) {
      throw new Error('Job is not in competition mode');
    }

    if (job.executions.length === 0) {
      throw new Error('No agents assigned for competition');
    }

    // 更新状态
    await this.prisma.job.update({
      where: { id: jobId },
      data: { status: JobStatus.IN_PROGRESS, startedAt: new Date() },
    });

    console.log(
      `[Competition] Starting parallel execution for Job ${jobId} with ${job.executions.length} agents`,
    );

    // 🚀 并行执行所有 Agent
    const executionPromises = job.executions.map((execution) =>
      this.executeAgentAsync(execution.id),
    );

    // 不等待完成，异步执行
    Promise.allSettled(executionPromises).then((results) => {
      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      console.log(
        `[Competition] Job ${jobId} execution completed: ${succeeded}/${results.length} succeeded`,
      );

      // 自动评分所有成功的执行
      if (this.competitionService) {
        job.executions.forEach((ex) => {
          this.competitionService.autoScoreExecution(ex.id).catch((err) => {
            console.error(`Auto-score failed for execution ${ex.id}:`, err);
          });
        });
      }
    });

    return {
      message: 'Competition started',
      executionCount: job.executions.length,
    };
  }

  /**
   * 🆕 执行单个 Agent（用于竞价）
   */
  private async executeAgentAsync(executionId: number) {
    try {
      const execution = await this.prisma.jobExecution.findUnique({
        where: { id: executionId },
        include: { agent: true, job: true },
      });

      if (!execution) {
        console.error(`[Execution ${executionId}] Not found`);
        return;
      }

      console.log(
        `[Execution ${executionId}] Starting Agent ${execution.agent.name}`,
      );

      // 更新状态
      await this.prisma.jobExecution.update({
        where: { id: executionId },
        data: { status: 'IN_PROGRESS', startedAt: new Date() },
      });

      // 调用 Agent
      const result = await this.callAgentEndpoint(
        execution.agent.endpointUrl,
        execution.job.inputData,
        execution.agent.endpointAuthType,
        execution.agent.secretKey ?? undefined,
      );

      // 保存结果
      await this.prisma.jobExecution.update({
        where: { id: executionId },
        data: {
          status: 'SUBMITTED',
          resultData: result,
          submittedAt: new Date(),
          completedAt: new Date(),
        },
      });

      console.log(`✅ Execution ${executionId} completed successfully`);
    } catch (error) {
      console.error(`❌ Execution ${executionId} failed:`, error);

      await this.prisma.jobExecution.update({
        where: { id: executionId },
        data: {
          status: 'FAILED',
          errorMessage: error.message,
        },
      });
    }
  }

  /**
   * 异步执行任务
   */
  private async executeJobAsync(jobId: number) {
    try {
      console.log(`[EXECUTION] Starting async execution for Job ${jobId}`);

      const job = await this.prisma.job.findUnique({
        where: { id: jobId },
        include: { assignedAgent: true },
      });

      if (!job || !job.assignedAgent) {
        console.error(`[EXECUTION] Job ${jobId} or assigned agent not found`);
        throw new Error('Job or assigned agent not found');
      }

      console.log(
        `[EXECUTION] Calling Agent ${job.assignedAgent.name} (ID: ${job.assignedAgent.id}) at ${job.assignedAgent.endpointUrl}`,
      );
      console.log(
        `[EXECUTION] Auth Type: ${job.assignedAgent.endpointAuthType}, SecretKey: ${job.assignedAgent.secretKey ? 'Present' : 'Missing'}`,
      );

      // 调用 Agent API
      const result = await this.callAgentEndpoint(
        job.assignedAgent.endpointUrl,
        job.inputData,
        job.assignedAgent.endpointAuthType,
        job.assignedAgent.secretKey ?? undefined,
      );

      // 保存结果并更新状态
      await this.prisma.job.update({
        where: { id: jobId },
        data: {
          status: JobStatus.SUBMITTED,
          resultData: result,
          submittedAt: new Date(),
        },
      });

      // 更新 Agent 统计
      if (job.assignedAgentId) {
        await this.prisma.agent.update({
          where: { id: job.assignedAgentId },
          data: {
            jobCount: { increment: 1 },
          },
        });
      }
    } catch (error) {
      console.error(`Job ${jobId} execution failed:`, error);

      // 标记为失败，重新开放
      await this.prisma.job.update({
        where: { id: jobId },
        data: {
          status: JobStatus.OPEN,
          assignedAgentId: null,
        },
      });
    }
  }

  /**
   * 提交任务结果（手动提交，如果自动执行失败）
   */
  async submitResult(jobId: number, userId: number, resultData: any) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: { assignedAgent: true },
    });

    if (!job) {
      throw new Error('Job not found');
    }

    const agent = await this.prisma.agent.findUnique({
      where: { id: job.assignedAgentId! },
    });

    if (!agent || agent.ownerId !== userId) {
      throw new ForbiddenException('Only the agent owner can submit results');
    }

    if (job.status !== JobStatus.IN_PROGRESS) {
      throw new ForbiddenException('Job must be in IN_PROGRESS status');
    }

    return this.prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.SUBMITTED,
        resultData,
        submittedAt: new Date(),
      },
    });
  }

  /**
   * 验收通过
   */
  async approveJob(
    jobId: number,
    userId: number,
    rating?: number,
    feedback?: string,
  ) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new Error('Job not found');
    }

    if (job.ownerId !== userId) {
      throw new ForbiddenException('Only the job owner can approve');
    }

    if (job.status !== JobStatus.SUBMITTED) {
      throw new ForbiddenException('Job must be in SUBMITTED status');
    }

    // 更新 Job 状态
    const updatedJob = await this.prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.COMPLETED,
        rating,
        feedback,
        approvedAt: new Date(),
        completedAt: new Date(),
      },
      include: { assignedAgent: true },
    });

    // 更新 Agent 评分（简单平均）
    if (rating && job.assignedAgentId) {
      const agent = await this.prisma.agent.findUnique({
        where: { id: job.assignedAgentId },
      });

      if (agent) {
        const currentRating = agent.rating || 0;
        const reviewCount = agent.reviewCount || 0;
        const newRating =
          (currentRating * reviewCount + rating) / (reviewCount + 1);

        await this.prisma.agent.update({
          where: { id: job.assignedAgentId },
          data: {
            rating: newRating,
            reviewCount: { increment: 1 },
          },
        });
      }
    }

    // 自动生成账单
    try {
      console.log(`✅ Job ${jobId} approved, generating bills...`);

      // 🆕 竞价模式：完成竞价统计
      if (job.competitionMode && this.competitionService) {
        await this.competitionService.finalizeCompetition(jobId);
      }

      await this.billsService.generateBill(jobId);
      console.log(`✅ Bills generated for Job ${jobId}`);
    } catch (billError) {
      console.error(`Failed to generate bills for Job ${jobId}:`, billError);
      // 不影响主流程
    }

    return updatedJob;
  }

  /**
   * 验收拒绝
   */
  async rejectJob(jobId: number, userId: number, reason: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new Error('Job not found');
    }

    if (job.ownerId !== userId) {
      throw new ForbiddenException('Only the job owner can reject');
    }

    if (job.status !== JobStatus.SUBMITTED) {
      throw new ForbiddenException('Job must be in SUBMITTED status');
    }

    // 标记为待争议（第五阶段会完善）
    return this.prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.DISPUTED,
        feedback: reason,
      },
    });
  }

  /**
   * 调用 Agent API 端点（流式版本）
   */
  private async callAgentEndpoint(
    url: string,
    input: any,
    authType: string,
    secretKey?: string,
  ): Promise<any> {
    const headers: any = { 'Content-Type': 'application/json' };

    if (authType === 'bearer' && secretKey) {
      // 🔑 关键：使用 secret 生成 JWT token
      console.log(
        '[AUTH] Generating JWT token with secretKey:',
        secretKey ? '***' : 'MISSING',
      );
      const token = jwt.sign(
        {
          sub: 'agent-guild',
          role: 'api',
          iss: 'agent-guild',
        },
        secretKey, // 使用存储的 Mastra JWT_AUTH_SECRET
        {
          expiresIn: '1h',
          algorithm: 'HS256', // 明确指定算法
        },
      );

      console.log(
        '[AUTH] Generated JWT token:',
        token.substring(0, 20) + '...',
      );
      headers.Authorization = `Bearer ${token}`; // 使用生成的 token
    } else if (authType === 'api-key' && secretKey) {
      console.log('[AUTH] Using API Key authentication');
      headers['X-API-Key'] = secretKey;
    } else {
      console.log('[AUTH] Using public (no auth) mode');
    }

    // 将输入数据转换成 Mastra 格式
    const mastraPayload = this.transformToMastraFormat(input);

    try {
      console.log('[SSE] Calling Agent API:', url);
      const response = await axios.post(url, mastraPayload, {
        headers,
        responseType: 'stream',
        timeout: 0,
      });

      console.log('[SSE] Response received, setting up stream handlers');

      let fullText = '';
      let buffer = '';
      let eventCount = 0;

      return await new Promise((resolve, reject) => {
        response.data.on('data', (chunk) => {
          eventCount++;
          const chunkStr = chunk.toString();
          console.log(
            `[SSE] Event ${eventCount}: received ${chunkStr.length} bytes`,
          );

          buffer += chunkStr;
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const jsonStr = line.slice(6).trim();
                if (!jsonStr) continue;

                const data = JSON.parse(jsonStr);

                if (data.type === 'text-delta' && data.payload?.text) {
                  fullText += data.payload.text;
                  console.log(
                    `[SSE] Text accumulated: ${fullText.length} chars`,
                  );
                }

                if (data.type === 'start') {
                  console.log(`[SSE] Stream started: ${data.runId}`);
                }

                if (data.type === 'finish') {
                  console.log(`[SSE] Stream finished`);
                }
              } catch (parseError) {
                console.warn('[SSE] Parse error:', line.slice(0, 50));
              }
            }
          }
        });

        response.data.on('end', () => {
          console.log(
            `[SSE] Stream ended. Total events: ${eventCount}, Total text: ${fullText.length} chars`,
          );

          // 如果没有收到 SSE 事件，但 buffer 中有内容，尝试作为普通 JSON 解析
          if (fullText.length === 0 && buffer.trim()) {
            console.log(
              '[SSE] No SSE events found, attempting to parse buffer as JSON',
            );
            try {
              const jsonData = JSON.parse(buffer);
              const output = jsonData.text || jsonData.output || buffer;
              console.log(
                `[SSE] Parsed buffer as JSON, text length: ${output.length}`,
              );
              resolve({
                output: output,
                text: output,
              });
              return;
            } catch (e) {
              console.log(
                '[SSE] Buffer is not valid JSON, returning raw buffer',
              );
              resolve({
                output: buffer,
                text: buffer,
              });
              return;
            }
          }

          resolve({
            output: fullText,
            text: fullText,
          });
        });

        response.data.on('error', (error) => {
          console.error('[SSE] Stream error:', error.message);
          reject(new Error(`Stream error: ${error.message}`));
        });
      });
    } catch (error) {
      console.error('[SSE] Request failed:', error.message);
      throw new Error(`Failed to execute agent: ${error.message}`);
    }
  }

  /**
   * 将 Job 的 inputData 转换成 Mastra Agent API 格式
   */
  private transformToMastraFormat(inputData: any): any {
    // 提取文本内容
    const content =
      typeof inputData === 'string'
        ? inputData
        : inputData?.content || JSON.stringify(inputData);

    // 转换成 Mastra 的 messages 格式
    return {
      messages: [
        {
          role: 'user',
          content: content,
        },
      ],
    };
  }
}
