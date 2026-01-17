import { ApiProperty } from '@nestjs/swagger';
import { VoteType } from '@prisma/client';

export class VoteEntity {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  proposalId: string;

  @ApiProperty({ example: '0x1234567890123456789012345678901234567890' })
  voter: string;

  @ApiProperty({ enum: VoteType, example: VoteType.FOR })
  support: VoteType;

  @ApiProperty({ example: '1000000000000000000000' })
  votingPower: bigint;

  @ApiProperty({ example: 'I support this proposal because...', nullable: true })
  reason?: string | null;

  @ApiProperty({ example: '0xabcdef...' })
  transactionHash: string;

  @ApiProperty({ example: '18000500' })
  blockNumber: bigint;

  @ApiProperty({ example: '2024-01-02T00:00:00Z' })
  timestamp: Date;

  constructor(partial: Partial<VoteEntity> & { reason?: string | null }) {
    Object.assign(this, partial);
  }
}
