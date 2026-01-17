import { IsString, IsNotEmpty, IsOptional, IsEthereumAddress, Matches, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ProposalStatus } from '@prisma/client';

export class CreateProposalDto {
  @ApiProperty({
    description: 'On-chain proposal ID',
    example: '12345678901234567890',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+$/, { message: 'proposalId must be a valid numeric string' })
  proposalId: string;

  @ApiProperty({
    description: 'Proposal title',
    example: 'Increase Treasury Allocation for Marketing',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Proposal description',
    example: 'This proposal suggests allocating 100,000 tokens from the treasury for marketing initiatives...',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    description: 'Proposer wallet address',
    example: '0x1234567890123456789012345678901234567890',
  })
  @IsEthereumAddress()
  @IsNotEmpty()
  proposer: string;

  @ApiProperty({
    description: 'Transaction hash of proposal creation',
    example: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^0x[a-fA-F0-9]{64}$/, { message: 'transactionHash must be a valid Ethereum transaction hash' })
  transactionHash: string;

  @ApiProperty({
    description: 'Block number when proposal was created',
    example: '18000000',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+$/, { message: 'blockNumber must be a valid numeric string' })
  blockNumber: string;

  @ApiProperty({
    description: 'Voting start block',
    example: '18000100',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+$/, { message: 'startBlock must be a valid numeric string' })
  startBlock: string;

  @ApiProperty({
    description: 'Voting end block',
    example: '18020100',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+$/, { message: 'endBlock must be a valid numeric string' })
  endBlock: string;

  @ApiProperty({
    description: 'Voting start time (ISO 8601)',
    example: '2024-01-01T00:00:00Z',
    required: false,
  })
  @IsOptional()
  @IsString()
  startTime?: string;

  @ApiProperty({
    description: 'Voting end time (ISO 8601)',
    example: '2024-01-08T00:00:00Z',
    required: false,
  })
  @IsOptional()
  @IsString()
  endTime?: string;

  @ApiProperty({
    description: 'Proposal status',
    enum: ProposalStatus,
    example: ProposalStatus.PENDING,
    required: false,
  })
  @IsOptional()
  @IsEnum(ProposalStatus)
  status?: ProposalStatus;
}
