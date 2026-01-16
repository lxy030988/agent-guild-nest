import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';

export class WalletOverviewDto {
  @ApiProperty({ description: '代理收入 (USDC)' })
  agentEarnings: string;

  @ApiProperty({ description: '待处理的代理收入 (USDC)' })
  agentEarningsPending: string;

  @ApiProperty({ description: '工作托管金额 (USDC)' })
  jobEscrow: string;

  @ApiProperty({ description: '待分配的托管金额 (USDC)' })
  jobEscrowPending: string;

  @ApiProperty({ description: '质押余额 (stUSDC)' })
  stakingBalance: string;

  @ApiProperty({ description: '累计奖励 (USDC)' })
  totalRewards: string;

  @ApiProperty({ description: '可领取奖励 (USDC)' })
  claimableRewards: string;

  @ApiProperty({ description: '当前 APY (%)' })
  apy: number;

  @ApiProperty({ description: '总资产 (USD)' })
  totalAssetsUsd: string;

  @ApiProperty({ description: '今日收益变化 (%)' })
  dailyChangePercent: number;

  @ApiProperty({ description: '今日收益变化金额 (USD)' })
  dailyChangeAmount: string;
}

export class StakingStatusDto {
  @ApiProperty({ description: '质押余额' })
  balance: string;

  @ApiProperty({ description: '可领取奖励' })
  claimableRewards: string;

  @ApiProperty({ description: '待解冻金额' })
  pendingWithdrawalAmount: string;

  @ApiProperty({ description: '解冻结束时间戳' })
  cooldownEndTime: string;

  @ApiProperty({ description: '剩余解冻时间（秒）' })
  remainingTime: string;

  @ApiProperty({ description: '是否在冷却期中' })
  isInCooldown: boolean;

  @ApiProperty({ description: '是否可领取' })
  canClaim: boolean;

  @ApiProperty({ description: '当前 APY' })
  apy: number;

  @ApiProperty({ description: '最小质押金额' })
  minStakeAmount: string;

  @ApiProperty({ description: '冷却周期（秒）' })
  cooldownPeriod: string;

  @ApiProperty({ description: '提前取回罚款比例 (%)' })
  earlyWithdrawalPenalty: number;
}

export class TransactionDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  type: 'stake' | 'unstake' | 'claim' | 'earn' | 'escrow';

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  amount: string;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  timestamp: string;

  @ApiProperty()
  status: 'pending' | 'completed' | 'failed';

  @ApiProperty({ nullable: true })
  txHash?: string;
}

export class GetTransactionsQueryDto {
  @ApiProperty({ required: false, description: '页码', default: 1 })
  @IsOptional()
  page?: number;

  @ApiProperty({ required: false, description: '每页数量', default: 10 })
  @IsOptional()
  limit?: number;

  @ApiProperty({ required: false, enum: ['24h', '7d', '30d', 'all'] })
  @IsOptional()
  @IsEnum(['24h', '7d', '30d', 'all'])
  timeFilter?: '24h' | '7d' | '30d' | 'all';

  @ApiProperty({ required: false, description: '交易类型过滤' })
  @IsOptional()
  @IsEnum(['stake', 'unstake', 'claim', 'earn', 'escrow'])
  type?: 'stake' | 'unstake' | 'claim' | 'earn' | 'escrow';
}
