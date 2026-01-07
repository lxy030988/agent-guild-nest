import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto, AgentStatus } from './dto/update-agent.dto';
import { QueryAgentDto } from './dto/query-agent.dto';
import { AgentCategory } from './dto/create-agent.dto';

@Injectable()
export class AgentsService {
  constructor(private prisma: PrismaService) {}

  /**
   * 创建 Agent
   */
  async create(userId: number, createAgentDto: CreateAgentDto) {
    // 生成 Secret Key（如果需要认证）
    let secretKey: string | undefined;
    if (
      createAgentDto.endpointAuthType === 'bearer' ||
      createAgentDto.endpointAuthType === 'api-key'
    ) {
      secretKey = this.generateSecretKey();
    }

    const agent = await this.prisma.agent.create({
      data: {
        name: createAgentDto.name,
        description: createAgentDto.description,
        shortDesc: createAgentDto.shortDesc,
        avatar: createAgentDto.avatar,
        category: createAgentDto.category as any,
        tags: createAgentDto.tags,
        capabilities: createAgentDto.capabilities || [],
        configuration: createAgentDto.configuration || Prisma.DbNull,
        endpointUrl: createAgentDto.endpointUrl,
        endpointAuthType: createAgentDto.endpointAuthType || 'public',
        healthCheckUrl: createAgentDto.healthCheckUrl,
        timeoutMs: createAgentDto.timeoutMs || 30000,
        secretKey,
        inputSchema: createAgentDto.inputSchema || Prisma.DbNull,
        outputSchema: createAgentDto.outputSchema || Prisma.DbNull,
        status: AgentStatus.ACTIVE, // 强制设为 ACTIVE，确保创建后可见
        ownerId: userId,
      },
      include: {
        owner: {
          select: {
            id: true,
            walletAddress: true,
            name: true,
          },
        },
      },
    });

    // 返回时仅在创建时显示 secretKey 一次
    return {
      ...agent,
      secretKey: secretKey || null, // 仅在响应中包含一次
    };
  }

  /**
   * 查询 Agent 列表（支持分页、筛选、排序）
   */
  async findAll(query: QueryAgentDto) {
    const {
      page = 1,
      limit = 20,
      category,
      tags,
      search,
      status = AgentStatus.ACTIVE,
      sortBy = 'createdAt',
      order = 'desc',
      verifiedOnly = false,
    } = query;

    const skip = (page - 1) * limit;

    // 构建查询条件
    const where: any = {
      status: status as any,
    };

    if (category) {
      where.category = category as any;
    }

    if (tags) {
      const tagList = tags.split(',').map((t) => t.trim());
      where.tags = {
        hasEvery: tagList, // AND 逻辑：包含所有指定标签
      };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (verifiedOnly) {
      where.isVerified = true;
    }

    // 查询总数和数据
    const [total, agents] = await Promise.all([
      this.prisma.agent.count({ where }),
      this.prisma.agent.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: order,
        },
        include: {
          owner: {
            select: {
              id: true,
              walletAddress: true,
              name: true,
            },
          },
        },
      }),
    ]);

    // 移除敏感字段
    const sanitizedAgents = agents.map((agent) => this.sanitizeAgent(agent));

    return {
      data: sanitizedAgents,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 获取单个 Agent
   */
  async findOne(id: number) {
    const agent = await this.prisma.agent.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            walletAddress: true,
            name: true,
          },
        },
      },
    });

    if (!agent) {
      throw new NotFoundException(`Agent with ID ${id} not found`);
    }

    // 增加浏览量
    await this.prisma.agent.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });

    return this.sanitizeAgent(agent);
  }

  /**
   * 更新 Agent
   */
  async update(id: number, userId: number, updateAgentDto: UpdateAgentDto) {
    // 检查 Agent 是否存在和权限
    const agent = await this.prisma.agent.findUnique({ where: { id } });
    if (!agent) {
      throw new NotFoundException(`Agent with ID ${id} not found`);
    }
    if (agent.ownerId !== userId) {
      throw new ForbiddenException('You can only update your own agents');
    }

    // 更新
    const updated = await this.prisma.agent.update({
      where: { id },
      data: {
        ...(updateAgentDto.name && { name: updateAgentDto.name }),
        ...(updateAgentDto.description && {
          description: updateAgentDto.description,
        }),
        ...(updateAgentDto.shortDesc !== undefined && {
          shortDesc: updateAgentDto.shortDesc,
        }),
        ...(updateAgentDto.avatar !== undefined && {
          avatar: updateAgentDto.avatar,
        }),
        ...(updateAgentDto.category && {
          category: updateAgentDto.category as any,
        }),
        ...(updateAgentDto.tags && { tags: updateAgentDto.tags }),
        ...(updateAgentDto.capabilities && {
          capabilities: updateAgentDto.capabilities,
        }),
        ...(updateAgentDto.configuration !== undefined && {
          configuration: updateAgentDto.configuration,
        }),
        ...(updateAgentDto.endpointUrl && {
          endpointUrl: updateAgentDto.endpointUrl,
        }),
        ...(updateAgentDto.endpointAuthType && {
          endpointAuthType: updateAgentDto.endpointAuthType,
        }),
        ...(updateAgentDto.healthCheckUrl !== undefined && {
          healthCheckUrl: updateAgentDto.healthCheckUrl,
        }),
        ...(updateAgentDto.timeoutMs && {
          timeoutMs: updateAgentDto.timeoutMs,
        }),
        ...(updateAgentDto.inputSchema !== undefined && {
          inputSchema: updateAgentDto.inputSchema,
        }),
        ...(updateAgentDto.outputSchema !== undefined && {
          outputSchema: updateAgentDto.outputSchema,
        }),
        ...(updateAgentDto.status && { status: updateAgentDto.status as any }),
      },
      include: {
        owner: {
          select: {
            id: true,
            walletAddress: true,
            name: true,
          },
        },
      },
    });

    return this.sanitizeAgent(updated);
  }

  /**
   * 删除 Agent
   */
  async remove(id: number, userId: number) {
    // 检查 Agent 是否存在和权限
    const agent = await this.prisma.agent.findUnique({ where: { id } });
    if (!agent) {
      throw new NotFoundException(`Agent with ID ${id} not found`);
    }
    if (agent.ownerId !== userId) {
      throw new ForbiddenException('You can only delete your own agents');
    }

    await this.prisma.agent.delete({ where: { id } });

    return { message: 'Agent deleted successfully' };
  }

  /**
   * 获取精选 Agents（按分类分组）
   */
  async getFeatured() {
    const categories = Object.values(AgentCategory);
    const result: any = {};

    for (const category of categories) {
      const agents = await this.prisma.agent.findMany({
        where: {
          category: category as any,
          status: 'ACTIVE' as any,
          isVerified: true,
        },
        take: 4, // 每个分类最多 4 个
        orderBy: {
          viewCount: 'desc',
        },
        include: {
          owner: {
            select: {
              id: true,
              walletAddress: true,
              name: true,
            },
          },
        },
      });

      result[category] = agents.map((agent) => this.sanitizeAgent(agent));
    }

    return result;
  }

  /**
   * 获取热门 Agents
   */
  async getPopular(limit: number = 10) {
    const agents = await this.prisma.agent.findMany({
      where: {
        status: 'ACTIVE' as any,
        isVerified: true,
      },
      take: limit,
      orderBy: {
        viewCount: 'desc',
      },
      include: {
        owner: {
          select: {
            id: true,
            walletAddress: true,
            name: true,
          },
        },
      },
    });

    return agents.map((agent) => this.sanitizeAgent(agent));
  }

  /**
   * 获取分类统计
   */
  async getCategoryStats() {
    const categories = Object.values(AgentCategory);
    const stats: any = {};

    for (const category of categories) {
      const count = await this.prisma.agent.count({
        where: {
          category: category as any,
          status: 'ACTIVE' as any,
        },
      });
      stats[category] = count;
    }

    return stats;
  }

  /**
   * 获取所有标签列表（去重）
   */
  async getAllTags() {
    const agents = await this.prisma.agent.findMany({
      where: {
        status: 'ACTIVE' as any,
      },
      select: {
        tags: true,
      },
    });

    // 合并所有标签并去重
    const allTags = new Set<string>();
    agents.forEach((agent) => {
      agent.tags.forEach((tag) => allTags.add(tag));
    });

    // 转换为数组并排序
    const uniqueTags = Array.from(allTags).sort();

    return {
      tags: uniqueTags,
      total: uniqueTags.length,
    };
  }

  // ============================================
  // 第三阶段预留方法
  // ============================================

  /**
   * 获取 Agent 的任务执行能力匹配度
   * 用于 Jobs 市场的智能匹配算法
   */
  async getAgentCapabilityScore(
    agentId: number,
    requiredCapabilities: string[],
  ): Promise<number> {
    // TODO: 第三阶段实现
    // 计算能力匹配分数，返回 0-100
    return 0;
  }

  /**
   * 批量获取可用 Agents
   * Jobs 发布时推荐合适的 Agents
   */
  async getAvailableAgents(filters: {
    capabilities: string[];
    minRating?: number;
    maxPrice?: number;
  }): Promise<any[]> {
    // TODO: 第三阶段实现
    return [];
  }

  /**
   * 更新 Agent 的任务统计
   * 任务完成后由 Jobs 模块调用
   */
  async updateJobStats(
    agentId: number,
    jobResult: {
      success: boolean;
      earnings: number;
      rating: number;
    },
  ): Promise<void> {
    // TODO: 第三阶段实现
    // 更新 jobCount, rating 等字段
    // 第四阶段：同时调用链上合约更新
  }

  // ============================================
  // 私有辅助方法
  // ============================================

  /**
   * 生成 Secret Key
   */
  private generateSecretKey(): string {
    const prefix = 'sk_agent_';
    const randomPart =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);
    return prefix + randomPart;
  }

  /**
   * 移除敏感字段（如 secretKey）
   */
  private sanitizeAgent(agent: any) {
    const { secretKey, ...sanitized } = agent;
    return sanitized;
  }
}
