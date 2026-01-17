import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { VoteChoice } from '@prisma/client';

export class SubmitVoteDto {
  @ApiProperty({
    description: '投票选项',
    enum: VoteChoice,
    example: VoteChoice.APPROVE,
  })
  @IsEnum(VoteChoice)
  @IsNotEmpty()
  choice: VoteChoice;

  @ApiPropertyOptional({
    description: '投票理由',
    example: '工作完成得非常出色，完全符合需求。',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({
    description: '代币权重(可选，前端传入用户代币余额)',
    example: '1500',
  })
  @IsString()
  @IsOptional()
  tokenWeight?: string;
}
