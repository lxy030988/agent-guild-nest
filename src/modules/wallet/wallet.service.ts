import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import {
  WalletOverview,
  StakingStatus,
  Transaction,
} from './entities/wallet.entity';
import { GetTransactionsQueryDto } from './dto/wallet.dto';

@Injectable()
export class WalletService {
  private readonly defaultApy: number;
  private readonly usdcDecimals: number = 6;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.defaultApy = this.configService.get<number>('DEFAULT_APY') || 8.5;
  }

  /**
   * 获取钱包概览数据
   */
  async getWalletOverview(walletAddress: string): Promise<WalletOverview> {
    const user = await this.prisma.user.findFirst({
      where: {
        walletAddress: walletAddress.toLowerCase(),
      },
    });

    const agentEarnings = user?.agentEarnings || '0';
    const agentEarningsPending = user?.pendingAgentEarnings || '0';
    const jobEscrow = user?.jobEscrowBalance || '0';
    const jobEscrowPending = user?.pendingJobEscrow || '0';

    const stakingBalance = await this.getStakingBalance(walletAddress);
    const { totalRewards, claimableRewards } = await this.getStakingRewards(
      walletAddress,
    );

    const totalAssets =
      Number(agentEarnings) +
      Number(jobEscrow) +
      Number(stakingBalance) +
      Number(totalRewards);

    const dailyChangePercent = 5.2;
    const dailyChangeAmount = (totalAssets * dailyChangePercent) / 100;

    return {
      agentEarnings: this.formatUsdc(agentEarnings),
      agentEarningsPending: this.formatUsdc(agentEarningsPending),
      jobEscrow: this.formatUsdc(jobEscrow),
      jobEscrowPending: this.formatUsdc(jobEscrowPending),
      stakingBalance: this.formatUsdc(stakingBalance),
      totalRewards: this.formatUsdc(totalRewards),
      claimableRewards: this.formatUsdc(claimableRewards),
      apy: this.defaultApy,
      totalAssetsUsd: this.formatUsdc(totalAssets.toString()),
      dailyChangePercent,
      dailyChangeAmount: this.formatUsdc(dailyChangeAmount.toString()),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * 获取质押状态
   */
  async getStakingStatus(walletAddress: string): Promise<StakingStatus> {
    const stakingRecord = await this.prisma.stakingRecord.findFirst({
      where: {
        user: {
          walletAddress: walletAddress.toLowerCase(),
        },
        status: 'ACTIVE',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const pendingWithdrawal = await this.prisma.withdrawalRequest.findFirst({
      where: {
        user: {
          walletAddress: walletAddress.toLowerCase(),
        },
        status: 'PENDING',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    let cooldownEndTime = '0';
    let remainingTime = '0';
    let isInCooldown = false;
    let canClaim = false;

    if (pendingWithdrawal) {
      const endTime = new Date(pendingWithdrawal.unlockAt).getTime();
      const now = Date.now();
      cooldownEndTime = endTime.toString();
      remainingTime = Math.max(0, Math.floor((endTime - now) / 1000)).toString();
      isInCooldown = remainingTime !== '0';
      canClaim = !isInCooldown && Number(pendingWithdrawal.amount) > 0;
    }

    const balance = stakingRecord?.amount || '0';
    const claimableRewards = await this.calculateClaimableRewards(walletAddress);

    return {
      balance: this.formatUsdc(balance),
      claimableRewards: this.formatUsdc(claimableRewards.toString()),
      pendingWithdrawalAmount: pendingWithdrawal
        ? this.formatUsdc(pendingWithdrawal.amount)
        : '0',
      cooldownEndTime,
      remainingTime,
      isInCooldown,
      canClaim,
      apy: this.defaultApy,
      minStakeAmount: '1000000',
      cooldownPeriod: '604800',
      earlyWithdrawalPenalty: 5,
    };
  }

  /**
   * 获取交易历史
   */
  async getTransactions(
    walletAddress: string,
    query: GetTransactionsQueryDto,
  ): Promise<{ data: Transaction[]; total: number; page: number; limit: number }> {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {
      user: {
        walletAddress: walletAddress.toLowerCase(),
      },
    };

    if (query.type) {
      where.type = query.type.toUpperCase();
    }

    const total = await this.prisma.transaction.count({ where });

    const transactions = await this.prisma.transaction.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
    });

    const data: Transaction[] = transactions.map((tx) => ({
      id: tx.id,
      type: tx.type.toLowerCase() as Transaction['type'],
      title: tx.title,
      description: tx.description,
      amount: this.formatUsdc(tx.amount),
      currency: tx.currency,
      timestamp: tx.createdAt.toISOString(),
      status: tx.status.toLowerCase() as Transaction['status'],
      txHash: tx.txHash || undefined,
    }));

    return { data, total, page, limit };
  }

  /**
   * 创建交易记录
   */
  async createTransaction(
    walletAddress: string,
    data: {
      type: Transaction['type'];
      title: string;
      description: string;
      amount: string;
      currency: string;
      status?: Transaction['status'];
      txHash?: string;
    },
  ): Promise<Transaction> {
    const user = await this.prisma.user.findFirst({
      where: { walletAddress: walletAddress.toLowerCase() },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const transaction = await this.prisma.transaction.create({
      data: {
        userId: user.id,
        type: data.type.toUpperCase().replace('-', '_') as any,
        title: data.title,
        description: data.description,
        amount: data.amount,
        currency: data.currency,
        status: (data.status || 'pending').toUpperCase() as any,
        txHash: data.txHash,
      },
    });

    return {
      id: transaction.id,
      type: transaction.type.toLowerCase() as Transaction['type'],
      title: transaction.title,
      description: transaction.description,
      amount: this.formatUsdc(transaction.amount),
      currency: transaction.currency,
      timestamp: transaction.createdAt.toISOString(),
      status: transaction.status.toLowerCase() as Transaction['status'],
      txHash: transaction.txHash || undefined,
    };
  }

  // ============ 内部辅助方法 ============

  private async getStakingBalance(walletAddress: string): Promise<string> {
    return '12750750';
  }

  private async getStakingRewards(walletAddress: string): Promise<{
    totalRewards: string;
    claimableRewards: string;
  }> {
    return {
      totalRewards: '12750750',
      claimableRewards: '1575000',
    };
  }

  private async calculateClaimableRewards(walletAddress: string): Promise<number> {
    return 1575;
  }

  private formatUsdc(microAmount: string | number): string {
    const amount = typeof microAmount === 'string' ? parseFloat(microAmount) : microAmount;
    return (amount / Math.pow(10, this.usdcDecimals)).toFixed(2);
  }
}
