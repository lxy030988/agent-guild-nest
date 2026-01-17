import { IsString, IsNotEmpty, IsEnum, IsOptional, IsEthereumAddress, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { VoteType } from '@prisma/client';

export class CreateVoteDto {
  @ApiProperty({
    description: 'Proposal ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsNotEmpty()
  proposalId: string;

  @ApiProperty({
    description: 'Voter wallet address',
    example: '0x1234567890123456789012345678901234567890',
  })
  @IsEthereumAddress()
  @IsNotEmpty()
  voter: string;

  @ApiProperty({
    description: 'Vote type',
    enum: VoteType,
    example: VoteType.FOR,
  })
  @IsEnum(VoteType)
  @IsNotEmpty()
  support: VoteType;

  @ApiProperty({
    description: 'Voting power amount',
    example: '1000000000000000000000',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+$/, { message: 'votingPower must be a valid numeric string' })
  votingPower: string;

  @ApiProperty({
    description: 'Vote reason/comment',
    example: 'I support this proposal because...',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({
    description: 'Transaction hash of the vote',
    example: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^0x[a-fA-F0-9]{64}$/, { message: 'transactionHash must be a valid Ethereum transaction hash' })
  transactionHash: string;

  @ApiProperty({
    description: 'Block number when vote was cast',
    example: '18000500',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+$/, { message: 'blockNumber must be a valid numeric string' })
  blockNumber: string;
}
