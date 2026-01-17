import { ApiProperty } from '@nestjs/swagger';

export class GovernanceStatsEntity {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: '0x1234567890123456789012345678901234567890' })
  walletAddress: string;

  @ApiProperty({ example: 5 })
  proposalsCreated: number;

  @ApiProperty({ example: 3 })
  proposalsExecuted: number;

  @ApiProperty({ example: 1 })
  proposalsCanceled: number;

  @ApiProperty({ example: 25 })
  totalVotes: number;

  @ApiProperty({ example: 20 })
  votesFor: number;

  @ApiProperty({ example: 4 })
  votesAgainst: number;

  @ApiProperty({ example: 1 })
  votesAbstain: number;

  @ApiProperty({ example: '5000000000000000000000' })
  totalStaked: bigint;

  @ApiProperty({ example: '3000000000000000000000' })
  currentStaked: bigint;

  @ApiProperty({ example: '4500000000000000000000' })
  totalVotingPower: bigint;

  @ApiProperty({ example: '2024-01-05T00:00:00Z', nullable: true })
  lastActivityAt?: Date | null;

  @ApiProperty({ example: '2024-01-01T00:00:00Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-05T00:00:00Z' })
  updatedAt: Date;

  constructor(partial: Record<string, any>) {
    Object.assign(this, partial);
  }
}
