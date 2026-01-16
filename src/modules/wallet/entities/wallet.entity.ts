export class WalletOverview {
  agentEarnings: string;
  agentEarningsPending: string;
  jobEscrow: string;
  jobEscrowPending: string;
  stakingBalance: string;
  totalRewards: string;
  claimableRewards: string;
  apy: number;
  totalAssetsUsd: string;
  dailyChangePercent: number;
  dailyChangeAmount: string;
  updatedAt: string;
}

export class StakingStatus {
  balance: string;
  claimableRewards: string;
  pendingWithdrawalAmount: string;
  cooldownEndTime: string;
  remainingTime: string;
  isInCooldown: boolean;
  canClaim: boolean;
  apy: number;
  minStakeAmount: string;
  cooldownPeriod: string;
  earlyWithdrawalPenalty: number;
}

export class Transaction {
  id: string;
  type: 'stake' | 'unstake' | 'claim' | 'earn' | 'escrow';
  title: string;
  description: string;
  amount: string;
  currency: string;
  timestamp: string;
  status: 'pending' | 'completed' | 'failed';
  txHash?: string;
}
