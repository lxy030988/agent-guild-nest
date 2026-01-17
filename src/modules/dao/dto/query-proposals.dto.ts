import { IsOptional, IsEnum, IsString, IsInt, Min, IsEthereumAddress } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProposalStatus } from '@prisma/client';

export class QueryProposalsDto {
  @ApiPropertyOptional({
    description: 'Filter by proposal status',
    enum: ProposalStatus,
    example: ProposalStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(ProposalStatus)
  status?: ProposalStatus;

  @ApiPropertyOptional({
    description: 'Filter by proposer wallet address',
    example: '0x1234567890123456789012345678901234567890',
  })
  @IsOptional()
  @IsEthereumAddress()
  proposer?: string;

  @ApiPropertyOptional({
    description: 'Search in title and description',
    example: 'treasury',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Page number (starting from 1)',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 10,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Sort by field (createdAt, endTime, votesFor)',
    example: 'createdAt',
    default: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({
    description: 'Sort order (asc, desc)',
    example: 'desc',
    default: 'desc',
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class PaginationMetaDto {
  @ApiPropertyOptional({ example: 100 })
  total: number;

  @ApiPropertyOptional({ example: 1 })
  page: number;

  @ApiPropertyOptional({ example: 10 })
  limit: number;

  @ApiPropertyOptional({ example: 10 })
  totalPages: number;

  @ApiPropertyOptional({ example: true })
  hasNextPage: boolean;

  @ApiPropertyOptional({ example: false })
  hasPreviousPage: boolean;
}
