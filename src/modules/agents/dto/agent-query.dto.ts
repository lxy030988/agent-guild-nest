import { Type } from 'class-transformer';
import {
  IsIn,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
export type AgentCategory =
  | 'PRODUCTIVITY_TOOLS'
  | 'CREATIVE_ASSISTANTS'
  | 'DEVELOPER_TOOLS'
  | 'OTHERS';
const agentCategoryValues: AgentCategory[] = [
  'PRODUCTIVITY_TOOLS',
  'CREATIVE_ASSISTANTS',
  'DEVELOPER_TOOLS',
  'OTHERS',
];

export type AgentSortBy =
  | 'rating'
  | 'price'
  | 'reviews'
  | 'created'
  | 'createdAt';
export type SortOrder = 'asc' | 'desc';
export type AgentStatus = 'DRAFT' | 'ACTIVE' | 'MINTED' | 'PAUSED' | 'ARCHIVED';
const agentStatusValues: AgentStatus[] = [
  'DRAFT',
  'ACTIVE',
  'MINTED',
  'PAUSED',
  'ARCHIVED',
];

export class AgentQueryDto {
  @ApiPropertyOptional({ description: '服务类别' })
  @IsOptional()
  @IsIn(agentCategoryValues)
  category?: AgentCategory;

  @ApiPropertyOptional({ description: '位置搜索(城市或国家)' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ description: '最低评分', example: 4 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  minRating?: number;

  @ApiPropertyOptional({ description: '最低价格', example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ description: '最高价格', example: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({
    description: '排序字段',
    enum: ['rating', 'price', 'reviews', 'created', 'createdAt'],
  })
  @IsOptional()
  @IsIn(['rating', 'price', 'reviews', 'created', 'createdAt'])
  sortBy?: AgentSortBy;

  @ApiPropertyOptional({ description: '排序顺序', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: SortOrder;

  @ApiPropertyOptional({ description: '排序顺序(兼容字段)', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: SortOrder;

  @ApiPropertyOptional({ description: '状态', enum: agentStatusValues })
  @IsOptional()
  @IsIn(agentStatusValues)
  status?: AgentStatus;

  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: '每页数量', default: 20, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({ description: '搜索关键词' })
  @IsOptional()
  @IsString()
  search?: string;
}
