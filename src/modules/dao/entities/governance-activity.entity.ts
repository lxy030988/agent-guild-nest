import { ApiProperty } from '@nestjs/swagger';
import { ActivityType } from '@prisma/client';

export class GovernanceActivityEntity {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ enum: ActivityType, example: ActivityType.VOTE_CAST })
  activityType: ActivityType;

  @ApiProperty({ example: '0x1234567890123456789012345678901234567890' })
  walletAddress: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', nullable: true })
  proposalId?: string | null;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', nullable: true })
  voteId?: string | null;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', nullable: true })
  stakeId?: string | null;

  @ApiProperty({ example: 'Voted FOR on proposal "Increase Treasury Allocation"' })
  description: string;

  @ApiProperty({ example: '{"votingPower": "1000000000000000000000"}', nullable: true })
  metadata?: string | null;

  @ApiProperty({ example: '0xabcdef...', nullable: true })
  transactionHash?: string | null;

  @ApiProperty({ example: '18000500', nullable: true })
  blockNumber?: bigint | null;

  @ApiProperty({ example: '2024-01-02T00:00:00Z' })
  timestamp: Date;

  constructor(partial: Record<string, any>) {
    Object.assign(this, partial);
  }
}
