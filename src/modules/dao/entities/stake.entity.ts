import { ApiProperty } from '@nestjs/swagger';

export class StakeEntity {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: '0x1234567890123456789012345678901234567890' })
  walletAddress: string;

  @ApiProperty({ example: '1000000000000000000000' })
  amount: bigint;

  @ApiProperty({ example: 2592000, description: 'Lock period in seconds (30 days)' })
  lockPeriod: number;

  @ApiProperty({ example: 1.5, description: 'Voting power multiplier' })
  multiplier: number;

  @ApiProperty({ example: '2024-01-01T00:00:00Z' })
  stakedAt: Date;

  @ApiProperty({ example: '2024-01-31T00:00:00Z' })
  unlockAt: Date;

  @ApiProperty({ example: null, nullable: true })
  withdrawnAt?: Date | null;

  @ApiProperty({ example: '0xabcdef...' })
  transactionHash: string;

  @ApiProperty({ example: '18000000' })
  blockNumber: bigint;

  @ApiProperty({ example: false })
  withdrawn: boolean;

  @ApiProperty({ example: null, nullable: true })
  withdrawTransactionHash?: string | null;

  constructor(partial: Record<string, any>) {
    Object.assign(this, partial);
  }
}
