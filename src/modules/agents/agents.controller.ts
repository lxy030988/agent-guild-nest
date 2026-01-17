import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AgentsService } from './agents.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { AgentQueryDto } from './dto/agent-query.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('agents')
@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: '获取 Agent 列表' })
  @ApiResponse({ status: 200, description: '返回 Agent 列表' })
  findAll(@Query() query: AgentQueryDto) {
    return this.agentsService.findAll(query);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取我的 Agent 列表' })
  @ApiResponse({ status: 200, description: '返回当前用户的 Agent 列表' })
  @ApiResponse({ status: 401, description: '未授权' })
  findMine(@CurrentUser('sub') userId: number) {
    return this.agentsService.findMine(userId);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: '获取 Agent 详情' })
  @ApiResponse({ status: 200, description: '返回 Agent 详情' })
  @ApiResponse({ status: 404, description: 'Agent 不存在' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.agentsService.findOne(id);
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建 Agent' })
  @ApiResponse({ status: 201, description: 'Agent 创建成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '已存在 Agent' })
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser('sub') userId: number,
    @Body() createAgentDto: CreateAgentDto,
  ) {
    return this.agentsService.create(userId, createAgentDto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新 Agent' })
  @ApiResponse({ status: 200, description: 'Agent 更新成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '无权限' })
  @ApiResponse({ status: 404, description: 'Agent 不存在' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('sub') userId: number,
    @Body() updateAgentDto: UpdateAgentDto,
  ) {
    return this.agentsService.update(id, userId, updateAgentDto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除 Agent' })
  @ApiResponse({ status: 200, description: 'Agent 删除成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '无权限' })
  @ApiResponse({ status: 404, description: 'Agent 不存在' })
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('sub') userId: number,
  ) {
    return this.agentsService.remove(id, userId);
  }
}
