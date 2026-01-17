import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateDisputeDto {
  @ApiProperty({ description: '任务 ID', example: 1 })
  @IsInt()
  @IsNotEmpty()
  jobId: number;

  @ApiProperty({ description: '争议标题', example: '工作成果不符合要求' })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(200)
  title: string;

  @ApiProperty({
    description: '争议原因',
    example: '提交的工作成果与需求描述严重不符，存在多处明显错误。',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(20)
  reason: string;

  @ApiPropertyOptional({
    description: '证据链接或描述',
    example: 'https://example.com/evidence.pdf',
  })
  @IsString()
  @IsOptional()
  evidence?: string;

  @ApiPropertyOptional({ description: '链上争议 ID' })
  @IsOptional()
  @IsString()
  chainDisputeId?: string;

  @ApiPropertyOptional({ description: '投票截止时间' })
  @IsOptional()
  @IsString()
  votingEndsAt?: string;
}
