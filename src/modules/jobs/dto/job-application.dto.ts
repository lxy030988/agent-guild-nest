import { IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateJobApplicationDto {
  @ApiPropertyOptional({ description: '申请留言' })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({ description: '建议价格', example: 45 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  proposedPrice?: number;

  @ApiPropertyOptional({
    description: '预计完成时间（分钟）',
    example: 120,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  estimatedTime?: number;
}

export class UpdateJobApplicationDto {
  @ApiProperty({
    description: '申请状态',
    enum: ['PENDING', 'ACCEPTED', 'REJECTED'],
  })
  @IsString()
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
}

export class QueryJobApplicationDto {
  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: '每页数量', default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: '申请状态',
    enum: ['PENDING', 'ACCEPTED', 'REJECTED'],
  })
  @IsOptional()
  @IsString()
  status?: 'PENDING' | 'ACCEPTED' | 'REJECTED';
}
