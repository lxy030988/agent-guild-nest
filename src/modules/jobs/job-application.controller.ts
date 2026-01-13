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
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JobApplicationService } from './job-application.service';
import {
  CreateJobApplicationDto,
  UpdateJobApplicationDto,
  QueryJobApplicationDto,
} from './dto/job-application.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('job applications')
@Controller('jobs')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class JobApplicationController {
  constructor(private readonly jobApplicationService: JobApplicationService) {}

  /**
   * Agent 申请 Job
   */
  @Post(':jobId/apply')
  @ApiOperation({ summary: 'Agent 申请 Job' })
  @ApiParam({ name: 'jobId', description: 'Job ID' })
  async applyToJob(
    @Param('jobId', ParseIntPipe) jobId: number,
    @CurrentUser() user: any,
    @Body() dto: CreateJobApplicationDto & { agentId: number },
  ) {
    return this.jobApplicationService.applyToJob(
      jobId,
      dto.agentId,
      user.userId,
      dto,
    );
  }

  /**
   * 获取 Job 的所有申请（Job owner）
   */
  @Get(':jobId/applications')
  @ApiOperation({ summary: '获取 Job 的所有申请' })
  @ApiParam({ name: 'jobId', description: 'Job ID' })
  async getJobApplications(
    @Param('jobId', ParseIntPipe) jobId: number,
    @CurrentUser() user: any,
    @Query() query: QueryJobApplicationDto,
  ) {
    return this.jobApplicationService.getJobApplications(
      jobId,
      user.userId,
      query,
    );
  }

  /**
   * 获取我的所有申请（Agent owner）
   */
  @Get('applications/my')
  @ApiOperation({ summary: '获取我的所有申请' })
  async getMyApplications(
    @CurrentUser() user: any,
    @Query() query: QueryJobApplicationDto,
  ) {
    return this.jobApplicationService.getMyApplications(user.userId, query);
  }

  /**
   * 更新申请状态（接受/拒绝）
   */
  @Put('applications/:applicationId')
  @ApiOperation({ summary: '更新申请状态' })
  @ApiParam({ name: 'applicationId', description: 'Application ID' })
  async updateApplicationStatus(
    @Param('applicationId', ParseIntPipe) applicationId: number,
    @CurrentUser() user: any,
    @Body() dto: UpdateJobApplicationDto,
  ) {
    return this.jobApplicationService.updateApplicationStatus(
      applicationId,
      user.userId,
      dto,
    );
  }

  /**
   * 撤回申请
   */
  @Delete('applications/:applicationId')
  @ApiOperation({ summary: '撤回申请' })
  @ApiParam({ name: 'applicationId', description: 'Application ID' })
  async withdrawApplication(
    @Param('applicationId', ParseIntPipe) applicationId: number,
    @CurrentUser() user: any,
  ) {
    return this.jobApplicationService.withdrawApplication(
      applicationId,
      user.userId,
    );
  }
}
