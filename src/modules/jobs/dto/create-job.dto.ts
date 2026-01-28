import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsArray,
  IsNumber,
  IsOptional,
  IsObject,
  Min,
  Max,
  IsDateString,
} from 'class-validator';

export enum JobCategory {
  CODE_REVIEW = 'CODE_REVIEW',
  CONTENT_CREATION = 'CONTENT_CREATION',
  DATA_ANALYSIS = 'DATA_ANALYSIS',
  TRANSLATION = 'TRANSLATION',
  TESTING = 'TESTING',
  RESEARCH = 'RESEARCH',
  OTHER = 'OTHER',
}

export enum MatchingMode {
  SMART = 'SMART',
  MANUAL = 'MANUAL',
  APPLICATION = 'APPLICATION',
  OPEN_MARKET = 'OPEN_MARKET',
}

/**
 * 创建 Job DTO
 */
export class CreateJobDto {
  @ApiProperty({ example: 'Code Review for React Component' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Review my React component for best practices' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ enum: JobCategory })
  @IsEnum(JobCategory)
  category: JobCategory;

  @ApiPropertyOptional({ example: ['react', 'code-review'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiProperty({ example: ['code-review', 'javascript'] })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  requiredCapabilities: string[];

  @ApiProperty({
    example: { code: 'function App() {...}' },
    description: '输入数据，可以是对象或字符串',
  })
  @IsNotEmpty()
  inputData: any;

  @ApiPropertyOptional({ example: 'Detailed feedback on code quality' })
  @IsString()
  @IsOptional()
  expectedOutput?: string;

  @ApiProperty({ example: 50.0 })
  @IsNumber()
  @Min(0.000001)
  budget: number;

  @ApiPropertyOptional({ example: 'USDC', default: 'USDC' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ example: '2026-01-15T00:00:00Z' })
  @IsDateString()
  @IsOptional()
  deadline?: string;

  @ApiPropertyOptional({ example: 60, description: '预计耗时（分钟）' })
  @IsNumber()
  @IsOptional()
  estimatedDuration?: number;

  @ApiPropertyOptional({
    enum: MatchingMode,
    default: MatchingMode.SMART,
    description:
      '匹配模式：SMART-智能匹配, MANUAL-手动选择, APPLICATION-申请制, OPEN_MARKET-开放市场',
  })
  @IsEnum(MatchingMode)
  @IsOptional()
  matchingMode?: MatchingMode;

  // 智能合约字段（前端传递）
  @ApiPropertyOptional({ example: '1', description: '链上任务 ID' })
  @IsString()
  @IsOptional()
  chainJobId?: string;

  @ApiPropertyOptional({
    example: '0x1234...',
    description: '创建任务的交易哈希',
  })
  @IsString()
  @IsOptional()
  chainTxHash?: string;

  @ApiPropertyOptional({
    example: '1704326400',
    description: '链上截止时间（Unix 时间戳）',
  })
  @IsString()
  @IsOptional()
  chainDeadline?: string;

  // 🆕 竞价模式字段
  @ApiPropertyOptional({
    example: false,
    default: false,
    description: '是否启用竞价模式（多 Agent 并行执行）',
  })
  @IsOptional()
  competitionMode?: boolean;

  @ApiPropertyOptional({
    example: 3,
    default: 3,
    description: '竞争 Agent 数量（2-5）',
  })
  @IsNumber()
  @Min(2)
  @Max(5)
  @IsOptional()
  competitorCount?: number;
}
