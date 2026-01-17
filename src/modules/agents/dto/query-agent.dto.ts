import {
  IsOptional,
  IsEnum,
  IsArray,
  IsString,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { AgentCategory } from './create-agent.dto';
import { AgentStatus } from './update-agent.dto';

/**
 * 查询 Agent 列表 DTO
 */
export class QueryAgentDto {
  @ApiPropertyOptional({
    description: '页码（从 1 开始）',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: '每页数量',
    example: 20,
    default: 20,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: '按分类筛选',
    enum: AgentCategory,
  })
  @IsOptional()
  @IsEnum(AgentCategory)
  category?: AgentCategory;

  @ApiPropertyOptional({
    description: '按标签筛选（逗号分隔，AND 逻辑）',
    example: 'code-review,javascript',
  })
  @IsOptional()
  @IsString()
  tags?: string;

  @ApiPropertyOptional({
    description: '搜索关键词（搜索 name、description）',
    example: 'code review',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: '按状态筛选',
    enum: AgentStatus,
    default: AgentStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(AgentStatus)
  status?: AgentStatus;

  @ApiPropertyOptional({
    description: '排序字段',
    enum: ['createdAt', 'viewCount', 'rating', 'jobCount'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortBy?: 'createdAt' | 'viewCount' | 'rating' | 'jobCount' = 'createdAt';

  @ApiPropertyOptional({
    description: '排序顺序',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsString()
  order?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({
    description: '仅显示已验证的 Agent',
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  verifiedOnly?: boolean;
}
