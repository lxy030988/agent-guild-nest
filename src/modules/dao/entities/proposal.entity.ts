import { ApiProperty } from '@nestjs/swagger';
import { ProposalStatus } from '@prisma/client';

export class ProposalEntity {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: '12345678901234567890' })
  proposalId: bigint;

  @ApiProperty({ example: 'Increase Treasury Allocation for Marketing' })
  title: string;

  @ApiProperty({ example: 'This proposal suggests allocating 100,000 tokens...' })
  description: string;

  @ApiProperty({ example: '0x1234567890123456789012345678901234567890' })
  proposer: string;

  @ApiProperty({ enum: ProposalStatus, example: ProposalStatus.ACTIVE })
  status: ProposalStatus;

  @ApiProperty({ example: '1000000000000000000000' })
  votesFor: bigint;

  @ApiProperty({ example: '500000000000000000000' })
  votesAgainst: bigint;

  @ApiProperty({ example: '100000000000000000000' })
  votesAbstain: bigint;

  @ApiProperty({ example: '0xabcdef...' })
  transactionHash: string;

  @ApiProperty({ example: '18000000' })
  blockNumber: bigint;

  @ApiProperty({ example: '2024-01-01T00:00:00Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-01T00:00:00Z' })
  updatedAt: Date;

  @ApiProperty({ example: '18000100' })
  startBlock: bigint;

  @ApiProperty({ example: '18020100' })
  endBlock: bigint;

  @ApiProperty({ example: '2024-01-01T00:00:00Z', nullable: true })
  startTime?: Date | null;

  @ApiProperty({ example: '2024-01-08T00:00:00Z', nullable: true })
  endTime?: Date | null;

  @ApiProperty({ example: true })
  quorumReached: boolean;

  @ApiProperty({ example: false })
  executed: boolean;

  @ApiProperty({ example: false })
  canceled: boolean;

  @ApiProperty({ example: '2024-01-09T00:00:00Z', nullable: true })
  executedAt?: Date | null;

  @ApiProperty({ example: null, nullable: true })
  canceledAt?: Date | null;

  @ApiProperty({ example: null, nullable: true })
  executionTransactionHash?: string | null;

  constructor(partial: Record<string, any>) {
    Object.assign(this, partial);
  }
}
