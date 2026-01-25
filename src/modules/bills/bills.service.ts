import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class BillsService {
  constructor(private prisma: PrismaService) {}

  /**
   * 获取账单列表
   */
  async getBills(
    userId: number,
    filters: {
      type?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const { type, startDate, endDate, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: any = { userId };

    if (type) {
      where.type = type;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [items, total] = await Promise.all([
      this.prisma.bill.findMany({
        where,
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
      this.prisma.bill.count({ where }),
    ]);

    return {
      items: items.map((bill) => ({
        id: bill.id,
        billNumber: bill.billNumber,
        type: bill.type,
        amount: bill.amount.toString(),
        currency: bill.currency,
        description: bill.description,
        job: bill.job,
        isPaid: bill.isPaid,
        createdAt: bill.createdAt,
      })),
      total,
      page,
      limit,
    };
  }

  /**
   * 获取账单详情
   */
  async getBillDetail(billId: number, userId: number) {
    const bill = await this.prisma.bill.findFirst({
      where: { id: billId, userId },
      include: {
        job: true,
        user: {
          select: {
            id: true,
            name: true,
            walletAddress: true,
          },
        },
      },
    });

    if (!bill) {
      throw new NotFoundException('Bill not found');
    }

    return {
      ...bill,
      amount: bill.amount.toString(),
    };
  }

  /**
   * 生成账单（Job 完成时调用）- 收取 5% 平台费
   */
  async generateBill(jobId: number) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        owner: true,
        assignedAgent: {
          include: { owner: true },
        },
        // 🆕 竞价模式：胜出者execution
        winnerExecution: {
          include: {
            agent: { include: { owner: true } },
          },
        },
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    // 🆕 确定支付对象
    let agentUser;
    let agentName;
    if (job.competitionMode && job.winnerExecution) {
      // 竞价模式：支付给胜出 Agent
      agentUser = job.winnerExecution.agent.owner;
      agentName = job.winnerExecution.agent.name;
    } else if (job.assignedAgent) {
      // 普通模式：支付给分配的 Agent
      agentUser = job.assignedAgent.owner;
      agentName = job.assignedAgent.name;
    } else {
      throw new NotFoundException('No agent to pay');
    }

    const timestamp = Date.now();
    const agentPayment = job.budget.mul(0.95); // 95%
    const platformFee = job.budget.mul(0.05); // 5%

    // 生成 Agent 收入账单 + 创建交易记录
    await this.prisma.bill.create({
      data: {
        billNumber: `BILL-INCOME-${timestamp}-${jobId}`,
        type: 'INCOME',
        amount: agentPayment,
        currency: 'ETH',
        userId: agentUser.id,
        jobId: job.id,
        description: `Agent task earnings: ${job.title}`,
        details: {
          budget: job.budget.toString(),
          platformFee: platformFee.toString(),
          actualIncome: agentPayment.toString(),
          competitionMode: job.competitionMode,
          agentName,
        },
        isPaid: true,
        paidAt: new Date(),
      },
    });

    // 创建 Agent 收入的 Transaction 记录
    await this.prisma.transaction.create({
      data: {
        type: 'JOB_PAYMENT',
        amount: agentPayment,
        currency: 'ETH',
        fromUserId: job.ownerId,
        toUserId: agentUser.id,
        jobId: job.id,
        txHash: job.chainTxHash, // 链上交易哈希
        description: `Payment for job: ${job.title}`,
        metadata: {
          budget: job.budget.toString(),
          platformFee: platformFee.toString(),
          competitionMode: job.competitionMode,
        },
      },
    });

    // 生成 Job Owner 支出账单
    await this.prisma.bill.create({
      data: {
        billNumber: `BILL-EXPENSE-${timestamp}-${jobId}`,
        type: 'EXPENSE',
        amount: job.budget,
        currency: 'ETH',
        userId: job.ownerId,
        jobId: job.id,
        description: `Job payment: ${job.title}`,
        details: {
          totalAmount: job.budget.toString(),
          agentPayment: agentPayment.toString(),
          platformFee: platformFee.toString(),
          competitionMode: job.competitionMode,
          agentName,
        },
        isPaid: true,
        paidAt: new Date(),
      },
    });

    // 创建平台费的 Transaction 记录
    await this.prisma.transaction.create({
      data: {
        type: 'PLATFORM_FEE',
        amount: platformFee,
        currency: 'ETH',
        fromUserId: job.ownerId,
        toUserId: null, // 平台收取
        jobId: job.id,
        txHash: job.chainTxHash,
        description: `Platform fee for job: ${job.title}`,
      },
    });

    console.log(`✅ Generated bills and transactions for Job #${jobId}`);
  }

  /**
   * 生成账单（DAO 争议解决时调用）- 不收取平台费
   */
  async generateBillForDAOResolution(jobId: number) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        owner: true,
        assignedAgent: {
          include: { owner: true },
        },
      },
    });

    if (!job || !job.assignedAgent) {
      throw new NotFoundException('Job or agent not found');
    }

    const timestamp = Date.now();
    // DAO 判定：Agent 获得 100% budget，无平台费
    const agentPayment = job.budget;
    const platformFee = new Prisma.Decimal(0);

    // 生成 Agent 收入账单 + 创建交易记录
    await this.prisma.bill.create({
      data: {
        billNumber: `BILL-DAO-INCOME-${timestamp}-${jobId}`,
        type: 'INCOME',
        amount: agentPayment,
        currency: 'ETH',
        userId: job.assignedAgent.ownerId,
        jobId: job.id,
        description: `DAO 裁决任务收益（无手续费）: ${job.title}`,
        details: {
          budget: job.budget.toString(),
          platformFee: '0',
          actualIncome: agentPayment.toString(),
          resolvedBy: 'DAO',
        },
        isPaid: true,
        paidAt: new Date(),
      },
    });

    // 创建 Agent 收入的 Transaction 记录
    await this.prisma.transaction.create({
      data: {
        type: 'JOB_PAYMENT',
        amount: agentPayment,
        currency: 'ETH',
        fromUserId: job.ownerId,
        toUserId: job.assignedAgent.ownerId,
        jobId: job.id,
        txHash: job.chainTxHash,
        description: `DAO 裁决支付: ${job.title}`,
        metadata: {
          budget: job.budget.toString(),
          platformFee: '0',
          resolvedBy: 'DAO',
        },
      },
    });

    // 生成 Job Owner 支出账单
    await this.prisma.bill.create({
      data: {
        billNumber: `BILL-DAO-EXPENSE-${timestamp}-${jobId}`,
        type: 'EXPENSE',
        amount: job.budget,
        currency: 'ETH',
        userId: job.ownerId,
        jobId: job.id,
        description: `DAO 裁决任务支付: ${job.title}`,
        details: {
          totalAmount: job.budget.toString(),
          agentPayment: agentPayment.toString(),
          platformFee: '0',
          resolvedBy: 'DAO',
        },
        isPaid: true,
        paidAt: new Date(),
      },
    });

    console.log(
      `✅ Generated DAO resolution bills (no platform fee) for Job #${jobId}`,
    );
  }
}
