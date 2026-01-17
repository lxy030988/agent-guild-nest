import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  Request,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AgentsService } from './agents.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { QueryAgentDto } from './dto/query-agent.dto';
import { Agent } from './entities/agent.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('agents')
@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  /**
   * 创建 Agent（需认证）
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建新 Agent' })
  @ApiResponse({ status: 201, description: 'Agent 创建成功', type: Agent })
  @ApiResponse({ status: 401, description: '未认证' })
  create(@Request() req, @Body() createAgentDto: CreateAgentDto) {
    return this.agentsService.create(req.user.userId, createAgentDto);
  }

  /**
   * 获取 Agent 列表（公开）
   */
  @Get()
  @Public()
  @ApiOperation({ summary: '获取 Agent 列表' })
  @ApiResponse({ status: 200, description: 'Agent 列表', type: [Agent] })
  findAll(@Query() query: QueryAgentDto) {
    return this.agentsService.findAll(query);
  }

  /**
   * 获取精选 Agents（公开）
   */
  @Get('featured')
  @Public()
  @ApiOperation({ summary: '获取精选 Agents（按分类分组）' })
  @ApiResponse({ status: 200, description: '精选 Agents' })
  getFeatured() {
    return this.agentsService.getFeatured();
  }

  /**
   * 获取热门 Agents（公开）
   */
  @Get('popular')
  @Public()
  @ApiOperation({ summary: '获取热门 Agents' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({ status: 200, description: '热门 Agents', type: [Agent] })
  getPopular(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    return this.agentsService.getPopular(parsedLimit);
  }

  /**
   * 获取分类统计（公开）
   */
  @Get('categories/stats')
  @Public()
  @ApiOperation({ summary: '获取分类统计' })
  @ApiResponse({ status: 200, description: '分类统计' })
  getCategoryStats() {
    return this.agentsService.getCategoryStats();
  }

  /**
   * 获取所有标签（公开）
   */
  @Get('tags')
  @Public()
  @ApiOperation({ summary: '获取所有标签列表' })
  @ApiResponse({ status: 200, description: '所有标签（去重并排序）' })
  getAllTags() {
    return this.agentsService.getAllTags();
  }

  /**
   * 获取单个 Agent（公开）
   */
  @Get(':id')
  @Public()
  @ApiOperation({ summary: '获取 Agent 详情' })
  @ApiResponse({ status: 200, description: 'Agent 详情', type: Agent })
  @ApiResponse({ status: 404, description: 'Agent 未找到' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.agentsService.findOne(id);
  }

  /**
   * 更新 Agent（需认证 + 权限）
   */
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新 Agent' })
  @ApiResponse({ status: 200, description: 'Agent 更新成功', type: Agent })
  @ApiResponse({ status: 401, description: '未认证' })
  @ApiResponse({ status: 403, description: '无权限' })
  @ApiResponse({ status: 404, description: 'Agent 未找到' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
    @Body() updateAgentDto: UpdateAgentDto,
  ) {
    return this.agentsService.update(id, req.user.userId, updateAgentDto);
  }

  /**
   * 删除 Agent（需认证 + 权限）
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除 Agent' })
  @ApiResponse({ status: 200, description: 'Agent 删除成功' })
  @ApiResponse({ status: 401, description: '未认证' })
  @ApiResponse({ status: 403, description: '无权限' })
  @ApiResponse({ status: 404, description: 'Agent 未找到' })
  remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    if (!req.user || !req.user.userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    return this.agentsService.remove(id, req.user.userId);
  }
}
