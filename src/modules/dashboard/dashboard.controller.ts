import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { QueryJobDto } from '../jobs/dto/query-job.dto';

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取 Dashboard 统计数据' })
  async getStats(@CurrentUser() user: any) {
    return this.dashboardService.getStats(user.userId);
  }

  @Get('summary')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取 Dashboard Jobs 概览' })
  async getSummary(
    @CurrentUser() user: any,
    @Query() query: QueryJobDto,
  ) {
    return this.dashboardService.getSummary(user.userId, query);
  }

  @Get('tabs')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取 Dashboard Tabs 统计' })
  async getTabs(@CurrentUser() user: any) {
    return this.dashboardService.getTabs(user.userId);
  }

  @Get('signed-agents')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取已签约 Agents 列表' })
  async getSignedAgents(@CurrentUser() user: any) {
    return this.dashboardService.getSignedAgents(user.userId);
  }
}
