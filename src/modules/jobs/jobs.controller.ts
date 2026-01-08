import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JobsService } from './jobs.service';
import { JobsMatchingService } from './jobs-matching.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { QueryJobDto } from './dto/query-job.dto';
import { JobsExecutionService } from './jobs-execution.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Jobs')
@Controller('jobs')
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly matchingService: JobsMatchingService,
    private readonly executionService: JobsExecutionService,
  ) {}

  /**
   * 创建 Job
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建 Job' })
  async create(@CurrentUser() user: any, @Body() dto: CreateJobDto) {
    const job = await this.jobsService.create(user.userId, dto);

    // 自动匹配 Agents（根据匹配模式决定是否自动分配）
    await this.matchingService.findMatchingAgents(
      job.id,
      dto.matchingMode || 'SMART',
    );

    return job;
  }

  /**
   * 获取 Jobs 统计数据
   */
  @Get('stats')
  @Public()
  @ApiOperation({ summary: '获取 Jobs 统计数据' })
  async getStats() {
    return this.jobsService.getStats();
  }

  /**
   * 获取 Jobs 列表
   */
  @Get()
  @Public()
  @ApiOperation({ summary: '获取 Jobs 列表' })
  findAll(@Query() query: QueryJobDto) {
    return this.jobsService.findAll(query);
  }

  /**
   * 获取 Job 详情
   */
  @Get(':id')
  @Public()
  @ApiOperation({ summary: '获取 Job 详情' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.jobsService.findOne(id);
  }

  /**
   * 获取 Job 的推荐 Agents
   */
  @Get(':id/recommendations')
  @Public()
  @ApiOperation({ summary: '获取 Job 的推荐 Agents' })
  getRecommendations(@Param('id', ParseIntPipe) id: number) {
    return this.matchingService.getRecommendations(id);
  }

  /**
   * 更新 Job
   */
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新 Job' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
    @Body() dto: UpdateJobDto,
  ) {
    return this.jobsService.update(id, user.userId, dto);
  }

  /**
   * 取消 Job
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '取消 Job' })
  cancel(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.jobsService.cancel(id, user.userId);
  }

  /**
   * 获取我发布的 Jobs
   */
  @Get('my/published')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取我发布的 Jobs' })
  getPublishedJobs(@CurrentUser() user: any, @Query() query: QueryJobDto) {
    return this.jobsService.findPublishedJobs(user.userId, query);
  }

  /**
   * 获取分配给我的 Jobs
   */
  @Get('my/assigned')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取分配给我的 Jobs' })
  getAssignedJobs(@CurrentUser() user: any, @Query() query: QueryJobDto) {
    return this.jobsService.findAssignedJobs(user.userId, query);
  }

  /**
   * Agent 所有者接受 Job
   */
  @Post(':id/accept')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Agent 所有者接受 Job' })
  acceptJob(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.executionService.acceptJob(id, user.userId);
  }

  /**
   * 开始执行 Job
   */
  @Post(':id/start')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '开始执行 Job' })
  startJob(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.executionService.startJob(id, user.userId);
  }

  /**
   * 提交 Job 结果
   */
  @Post(':id/submit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '提交 Job 结果' })
  submitResult(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
    @Body() body: { resultData: any },
  ) {
    return this.executionService.submitResult(id, user.userId, body.resultData);
  }

  /**
   * 验收通过
   */
  @Post(':id/approve')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '验收通过' })
  approveJob(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
    @Body() body: { rating?: number; feedback?: string },
  ) {
    return this.executionService.approveJob(
      id,
      user.userId,
      body.rating,
      body.feedback,
    );
  }

  /**
   * 验收拒绝
   */
  @Post(':id/reject')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '验收拒绝' })
  rejectJob(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
    @Body() body: { reason: string },
  ) {
    return this.executionService.rejectJob(id, user.userId, body.reason);
  }

  /**
   * 手动分配 Agent 到 Job
   */
  @Post(':id/assign')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '手动分配 Agent 到 Job' })
  assignAgent(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
    @Body() body: { agentId: number },
  ) {
    return this.matchingService.assignAgent(id, body.agentId, user.userId);
  }
}
