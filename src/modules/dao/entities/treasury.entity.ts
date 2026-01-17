import { ApiProperty } from '@nestjs/swagger';
import { AssetType } from '@prisma/client';

export class TreasuryEntity {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ enum: AssetType, example: AssetType.ERC20 })
  assetType: AssetType;

  @ApiProperty({ example: '0x1234567890123456789012345678901234567890', nullable: true })
  tokenAddress?: string | null;

  @ApiProperty({ example: null, nullable: true })
  tokenId?: bigint | null;

  @ApiProperty({ example: '1000000000000000000000' })
  balance: bigint;

  @ApiProperty({ example: 'USDC', nullable: true })
  symbol?: string | null;

  @ApiProperty({ example: 'USD Coin', nullable: true })
  name?: string | null;

  @ApiProperty({ example: 6, nullable: true })
  decimals?: number | null;

  @ApiProperty({ example: '2024-01-01T00:00:00Z' })
  lastUpdated: Date;

  @ApiProperty({ example: '2024-01-01T00:00:00Z' })
  createdAt: Date;

  constructor(partial: Record<string, any>) {
    Object.assign(this, partial);
  }
}
