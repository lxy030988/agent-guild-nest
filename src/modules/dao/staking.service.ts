import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ContractsService } from '../web3/contracts.service';
import { StakeEntity } from './entities/stake.entity';
import { ActivityType } from '@prisma/client';

/**
 * Staking Service
 * Handles staking data tracking and voting power calculations
 */
@Injectable()
export class StakingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contractsService: ContractsService,
  ) {}

  /**
   * Get all stakes for a wallet address
   */
  async findByWallet(walletAddress: string): Promise<StakeEntity[]> {
    const stakes = await this.prisma.stake.findMany({
      where: {
        walletAddress: walletAddress.toLowerCase(),
      },
      orderBy: {
        stakedAt: 'desc',
      },
    });

    return stakes.map((stake) => new StakeEntity(stake));
  }

  /**
   * Get active stakes for a wallet address
   */
  async getActiveStakes(walletAddress: string): Promise<StakeEntity[]> {
    const stakes = await this.prisma.stake.findMany({
      where: {
        walletAddress: walletAddress.toLowerCase(),
        withdrawn: false,
        unlockAt: {
          gte: new Date(),
        },
      },
      orderBy: {
        stakedAt: 'desc',
      },
    });

    return stakes.map((stake) => new StakeEntity(stake));
  }

  /**
   * Get total voting power for a wallet address
   */
  async getVotingPower(walletAddress: string): Promise<{
    totalStaked: string;
    votingPower: string;
    activeStakes: number;
    onChainVotingPower: string;
  }> {
    // Get stakes from database
    const stakes = await this.prisma.stake.findMany({
      where: {
        walletAddress: walletAddress.toLowerCase(),
        withdrawn: false,
      },
    });

    // Calculate total staked and voting power
    let totalStaked = 0n;
    let votingPower = 0n;

    for (const stake of stakes) {
      totalStaked += stake.amount;
      votingPower += BigInt(Math.floor(Number(stake.amount) * stake.multiplier));
    }

    // Get on-chain voting power
    let onChainVotingPower = 0n;
    try {
      onChainVotingPower = await this.contractsService.getCurrentVotingPower(walletAddress as `0x${string}`);
    } catch (error) {
      console.error('Error fetching on-chain voting power:', error);
    }

    return {
      totalStaked: totalStaked.toString(),
      votingPower: votingPower.toString(),
      activeStakes: stakes.length,
      onChainVotingPower: onChainVotingPower.toString(),
    };
  }

  /**
   * Record a new stake
   */
  async createStake(data: {
    walletAddress: string;
    amount: string;
    lockPeriod: number;
    multiplier: number;
    unlockAt: Date;
    transactionHash: string;
    blockNumber: string;
  }): Promise<StakeEntity> {
    const stake = await this.prisma.stake.create({
      data: {
        walletAddress: data.walletAddress.toLowerCase(),
        amount: BigInt(data.amount),
        lockPeriod: data.lockPeriod,
        multiplier: data.multiplier,
        unlockAt: data.unlockAt,
        transactionHash: data.transactionHash,
        blockNumber: BigInt(data.blockNumber),
      },
    });

    // Create governance activity
    await this.prisma.governanceActivity.create({
      data: {
        activityType: ActivityType.STAKE_CREATED,
        walletAddress: stake.walletAddress,
        stakeId: stake.id,
        description: `Staked ${stake.amount.toString()} tokens for ${stake.lockPeriod} seconds`,
        metadata: JSON.stringify({
          amount: stake.amount.toString(),
          lockPeriod: stake.lockPeriod,
          multiplier: stake.multiplier,
        }),
        transactionHash: stake.transactionHash,
        blockNumber: stake.blockNumber,
      },
    });

    // Update staking stats
    await this.updateStakingStats(stake.walletAddress, stake.amount, 'stake');

    return new StakeEntity(stake);
  }

  /**
   * Mark a stake as withdrawn
   */
  async withdrawStake(stakeId: string, transactionHash: string): Promise<StakeEntity> {
    const stake = await this.prisma.stake.findUnique({
      where: { id: stakeId },
    });

    if (!stake) {
      throw new NotFoundException(`Stake #${stakeId} not found`);
    }

    const updated = await this.prisma.stake.update({
      where: { id: stakeId },
      data: {
        withdrawn: true,
        withdrawnAt: new Date(),
        withdrawTransactionHash: transactionHash,
      },
    });

    // Create governance activity
    await this.prisma.governanceActivity.create({
      data: {
        activityType: ActivityType.STAKE_WITHDRAWN,
        walletAddress: updated.walletAddress,
        stakeId: updated.id,
        description: `Withdrew ${updated.amount.toString()} tokens`,
        metadata: JSON.stringify({
          amount: updated.amount.toString(),
        }),
        transactionHash,
      },
    });

    // Update staking stats
    await this.updateStakingStats(updated.walletAddress, updated.amount, 'withdraw');

    return new StakeEntity(updated);
  }

  /**
   * Get staking summary for a wallet
   */
  async getStakingSummary(walletAddress: string) {
    const [activeStakes, totalStakes, votingPowerData] = await Promise.all([
      this.getActiveStakes(walletAddress),
      this.prisma.stake.count({
        where: { walletAddress: walletAddress.toLowerCase() },
      }),
      this.getVotingPower(walletAddress),
    ]);

    // Calculate unlockable stakes
    const unlockableStakes = await this.prisma.stake.findMany({
      where: {
        walletAddress: walletAddress.toLowerCase(),
        withdrawn: false,
        unlockAt: {
          lte: new Date(),
        },
      },
    });

    const unlockableAmount = unlockableStakes.reduce((sum, stake) => sum + stake.amount, 0n);

    return {
      totalStakes,
      activeStakes: activeStakes.length,
      totalStaked: votingPowerData.totalStaked,
      votingPower: votingPowerData.votingPower,
      onChainVotingPower: votingPowerData.onChainVotingPower,
      unlockableStakes: unlockableStakes.length,
      unlockableAmount: unlockableAmount.toString(),
    };
  }

  /**
   * Update staking statistics
   */
  private async updateStakingStats(walletAddress: string, amount: bigint, action: 'stake' | 'withdraw') {
    const currentStats = await this.prisma.governanceStats.findUnique({
      where: { walletAddress: walletAddress.toLowerCase() },
    });

    const totalStaked = currentStats?.totalStaked || 0n;
    const currentStaked = currentStats?.currentStaked || 0n;

    const updateData: any = {
      lastActivityAt: new Date(),
    };

    if (action === 'stake') {
      updateData.totalStaked = totalStaked + amount;
      updateData.currentStaked = currentStaked + amount;
    } else if (action === 'withdraw') {
      updateData.currentStaked = currentStaked > amount ? currentStaked - amount : 0n;
    }

    await this.prisma.governanceStats.upsert({
      where: { walletAddress: walletAddress.toLowerCase() },
      create: {
        walletAddress: walletAddress.toLowerCase(),
        totalStaked: action === 'stake' ? amount : 0n,
        currentStaked: action === 'stake' ? amount : 0n,
        lastActivityAt: new Date(),
      },
      update: updateData,
    });
  }
}
