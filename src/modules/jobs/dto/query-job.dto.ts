import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { JobCategory, JobStatus } from '@prisma/client';

/**
 * 查询 Job DTO
 */
export class QueryJobDto {
  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional({ enum: JobCategory })
  @IsEnum(JobCategory)
  @IsOptional()
  category?: JobCategory;

  @ApiPropertyOptional({ enum: JobStatus })
  @IsEnum(JobStatus)
  @IsOptional()
  status?: JobStatus;

  @ApiPropertyOptional({ example: 'code review' })
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: ['createdAt', 'budget'], default: 'createdAt' })
  @IsOptional()
  sortBy?: 'createdAt' | 'budget';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  order?: 'asc' | 'desc';
}
