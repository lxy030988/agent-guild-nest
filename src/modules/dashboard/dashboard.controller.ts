import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';
import {
  DashboardStatsDto,
  DashboardTabCountsDto,
  RevenueChartDataDto,
  JobsBreakdownDto,
  ActivityListResponseDto,
} from './dto/dashboard.dto';

@ApiTags('dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: '获取Dashboard统计数据' })
  @ApiResponse({
    status: 200,
    description: '返回6个核心指标数据',
    type: DashboardStatsDto,
  })
  async getStats(@Req() req): Promise<DashboardStatsDto> {
    return this.dashboardService.getDashboardStats(req.user.userId);
  }

  @Get('charts/revenue')
  @ApiOperation({ summary: '获取收益趋势图表数据' })
  @ApiQuery({
    name: 'days',
    required: false,
    description: '查询最近N天的数据',
    example: 30,
  })
  @ApiResponse({
    status: 200,
    description: '返回每日累计收益数据',
    type: [RevenueChartDataDto],
  })
  async getRevenueChart(
    @Req() req,
    @Query('days') days: number = 30,
  ): Promise<RevenueChartDataDto[]> {
    return this.dashboardService.getRevenueChartData(req.user.userId, +days);
  }

  @Get('charts/jobs-breakdown')
  @ApiOperation({ summary: '获取任务状态分布数据' })
  @ApiResponse({
    status: 200,
    description: '返回各状态任务的数量统计',
    type: JobsBreakdownDto,
  })
  async getJobsBreakdown(@Req() req): Promise<JobsBreakdownDto> {
    return this.dashboardService.getJobsBreakdown(req.user.userId);
  }

  @Get('activity')
  @ApiOperation({ summary: '获取活动动态列表' })
  @ApiQuery({
    name: 'page',
    required: false,
    description: '页码',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: '每页数量',
    example: 20,
  })
  @ApiResponse({
    status: 200,
    description: '返回用户最近的活动记录',
    type: ActivityListResponseDto,
  })
  async getActivity(
    @Req() req,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ): Promise<ActivityListResponseDto> {
    return this.dashboardService.getActivityFeed(
      req.user.userId,
      +page,
      +limit,
    );
  }

  @Get('loadTabCounts')
  @ApiOperation({ summary: '获取Dashboard Tabs统计数据' })
  @ApiResponse({
    status: 200,
    description: '返回Tabs统计数量',
    type: DashboardTabCountsDto,
  })
  async loadTabCounts(@Req() req): Promise<DashboardTabCountsDto> {
    return this.dashboardService.loadTabCounts(req.user.userId);
  }

  @Get('signed-agents')
  @ApiOperation({ summary: '获取已签署的 Agents' })
  @ApiQuery({
    name: 'page',
    required: false,
    description: '页码',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: '每页数量',
    example: 20,
  })
  async getSignedAgents(
    @Req() req,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.dashboardService.getSignedAgents(req.user.userId, +page, +limit);
  }
}
