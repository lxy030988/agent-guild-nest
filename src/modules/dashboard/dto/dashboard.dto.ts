import { ApiProperty } from '@nestjs/swagger';

/**
 * Dashboard 统计数据 DTO
 */
export class DashboardStatsDto {
  @ApiProperty({ description: '已发布Agent数量', example: 5 })
  publishedAgents: number;

  @ApiProperty({
    description: '活跃任务数（OPEN/MATCHED/IN_PROGRESS）',
    example: 12,
  })
  activeJobs: number;

  @ApiProperty({ description: '已完成任务数', example: 8 })
  completedJobs: number;

  @ApiProperty({ description: '总收益（ETH）', example: '2.5' })
  totalEarnings: string;

  @ApiProperty({ description: '进行中任务数', example: 3 })
  inProgressJobs: number;

  @ApiProperty({ description: '争议数量', example: 1 })
  disputes: number;
}

/**
 * 收益图表数据点 DTO
 */
export class RevenueChartDataDto {
  @ApiProperty({ description: '日期', example: '2026-01-09' })
  date: string;

  @ApiProperty({ description: '收益金额（ETH）', example: '0.15' })
  amount: string;
}

/**
 * 任务状态分布 DTO
 */
export class JobsBreakdownDto {
  @ApiProperty({ description: '开放中任务数', example: 5 })
  open: number;

  @ApiProperty({ description: '已匹配任务数', example: 3 })
  matched: number;

  @ApiProperty({ description: '进行中任务数', example: 4 })
  inProgress: number;

  @ApiProperty({ description: '已完成任务数', example: 12 })
  completed: number;

  @ApiProperty({ description: '已取消任务数', example: 2 })
  cancelled: number;
}

/**
 * 活动动态项 DTO
 */
export class ActivityItemDto {
  @ApiProperty({ description: '活动ID', example: 1 })
  id: number;

  @ApiProperty({
    description: '活动类型',
    enum: ['job', 'agent', 'bill', 'dispute'],
    example: 'job',
  })
  type: 'job' | 'agent' | 'bill' | 'dispute';

  @ApiProperty({ description: '动作', example: 'created' })
  action: string;

  @ApiProperty({ description: '描述', example: '创建了新任务：数据分析' })
  description: string;

  @ApiProperty({ description: '关联ID', example: 123, required: false })
  relatedId?: number;

  @ApiProperty({ description: '创建时间', example: '2026-01-09T15:30:00Z' })
  createdAt: Date;
}

/**
 * 活动列表响应 DTO
 */
export class ActivityListResponseDto {
  @ApiProperty({ type: [ActivityItemDto], description: '活动列表' })
  items: ActivityItemDto[];

  @ApiProperty({ description: '总数', example: 50 })
  total: number;

  @ApiProperty({ description: '当前页', example: 1 })
  page: number;

  @ApiProperty({ description: '每页数量', example: 20 })
  limit: number;
}
