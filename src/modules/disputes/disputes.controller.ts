import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { DisputesService } from './disputes.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { SubmitVoteDto } from './dto/submit-vote.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DisputeStatus } from '@prisma/client';

@ApiTags('disputes')
@Controller('disputes')
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建争议' })
  @ApiResponse({ status: 201, description: '争议创建成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 404, description: '任务不存在' })
  async createDispute(
    @CurrentUser() user: any,
    @Body() createDisputeDto: CreateDisputeDto,
  ) {
    return this.disputesService.createDispute(user.userId, createDisputeDto);
  }

  @Get()
  @ApiOperation({ summary: '获取争议列表' })
  @ApiQuery({ name: 'status', enum: DisputeStatus, required: false })
  @ApiResponse({ status: 200, description: '返回争议列表' })
  async listDisputes(@Query('status') status?: DisputeStatus) {
    return this.disputesService.listDisputes(status ? { status } : undefined);
  }

  @Get('stats')
  @ApiOperation({ summary: '获取争议统计数据' })
  @ApiResponse({ status: 200, description: '返回统计数据' })
  async getStatistics() {
    return this.disputesService.getStatistics();
  }

  @Get('my-votes')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取我的投票记录' })
  @ApiResponse({ status: 200, description: '返回用户的投票记录' })
  async getMyVotes(@CurrentUser() user: any) {
    return this.disputesService.getMyVotes(user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取争议详情' })
  @ApiResponse({ status: 200, description: '返回争议详情' })
  @ApiResponse({ status: 404, description: '争议不存在' })
  async getDisputeById(@Param('id', ParseIntPipe) id: number) {
    return this.disputesService.getDisputeById(id);
  }

  @Post(':id/vote')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '提交投票' })
  @ApiResponse({ status: 201, description: '投票成功' })
  @ApiResponse({ status: 400, description: '请求参数错误或已投票' })
  @ApiResponse({ status: 404, description: '争议不存在' })
  async submitVote(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
    @Body() submitVoteDto: SubmitVoteDto,
  ) {
    return this.disputesService.submitVote(id, user.userId, submitVoteDto);
  }

  @Post(':id/resolve')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '解决争议（计算投票结果）' })
  @ApiResponse({ status: 200, description: '争议已解决' })
  @ApiResponse({ status: 400, description: '投票期尚未结束' })
  @ApiResponse({ status: 404, description: '争议不存在' })
  async resolveDispute(@Param('id', ParseIntPipe) id: number) {
    return this.disputesService.resolveDispute(id);
  }
}
