import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, AgentCategory } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { AgentQueryDto } from './dto/agent-query.dto';
import { PricingDto, ServiceDto } from './dto/agent.dto';

interface PriceRange {
  minPrice: number | null;
  maxPrice: number | null;
}

@Injectable()
export class AgentsService {
  constructor(private readonly prisma: PrismaService) {}

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private getJsonArray<T>(value: Prisma.JsonValue | null): T[] {
    return Array.isArray(value) ? (value as T[]) : [];
  }

  private getJsonObject(value: Prisma.JsonValue | null): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }

  private toAgentCategory(value: string): AgentCategory {
    const normalized = value.trim().toUpperCase();
    const categories = AgentCategory;
    return (Object.values(categories) as string[]).includes(normalized)
      ? (normalized as AgentCategory)
      : AgentCategory.OTHERS;
  }

  private calculatePriceRange(
    pricing: PricingDto[] = [],
    services: ServiceDto[] = [],
  ): PriceRange {
    const candidates = [
      ...pricing.map((item) => item.price),
      ...services.map((item) => item.price),
    ].filter((value) => typeof value === 'number' && !Number.isNaN(value));

    if (candidates.length === 0) {
      return { minPrice: null, maxPrice: null };
    }

    return {
      minPrice: Math.min(...candidates),
      maxPrice: Math.max(...candidates),
    };
  }

  async create(userId: number, createAgentDto: CreateAgentDto) {
    if (!userId) {
      throw new UnauthorizedException('Missing authenticated user');
    }

    const agentName = createAgentDto.name ?? createAgentDto.title;
    if (!agentName) {
      throw new BadRequestException('name or title is required');
    }

    const priceRange = this.calculatePriceRange(
      createAgentDto.pricing ?? [],
      createAgentDto.services ?? [],
    );

    const capabilitiesFromServices =
      createAgentDto.services?.map((service) => service.name) ?? [];
    const capabilities =
      createAgentDto.capabilities ?? capabilitiesFromServices;

    return this.prisma.agent.create({
      data: {
        owner: {
          connect: { id: userId },
        },
        name: agentName,
        description: createAgentDto.description,
        shortDesc: createAgentDto.shortDesc,
        category: this.toAgentCategory(createAgentDto.category),
        tags: createAgentDto.tags ?? [],
        status: createAgentDto.isActive === false ? 'PAUSED' : 'ACTIVE',
        capabilities,
        availability: createAgentDto.isActive ?? true,
        minPrice: priceRange.minPrice,
        maxPrice: priceRange.maxPrice,
        endpointUrl: createAgentDto.endpointUrl,
        endpointAuthType: createAgentDto.endpointAuthType ?? 'public',
        timeoutMs: createAgentDto.timeoutMs ?? 30000,
        secretKey: createAgentDto.secretKey ?? undefined,
        configuration: this.toJsonValue({
          subcategory: createAgentDto.subcategory,
          location: createAgentDto.location,
          services: createAgentDto.services,
          pricing: createAgentDto.pricing,
          availability: createAgentDto.availability,
          responseTime: createAgentDto.responseTime,
          languages: createAgentDto.languages,
        }),
      },
      include: {
        owner: {
          select: {
            id: true,
            walletAddress: true,
            name: true,
            email: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
  }

  async findAll(query: AgentQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(50, query.limit ?? 20);
    const skip = (page - 1) * limit;

    const filters: Array<Record<string, unknown>> = [];

    if (query.category) {
      filters.push({ category: query.category });
    }

    if (query.location) {
      filters.push({
        OR: [
          {
            locationCity: {
              contains: query.location,
              mode: 'insensitive',
            },
          },
          {
            locationCountry: {
              contains: query.location,
              mode: 'insensitive',
            },
          },
        ],
      });
    }

    if (query.minRating !== undefined) {
      filters.push({ rating: { gte: query.minRating } });
    }

    if (query.minPrice !== undefined) {
      filters.push({ maxPrice: { gte: query.minPrice } });
    }

    if (query.maxPrice !== undefined) {
      filters.push({ minPrice: { lte: query.maxPrice } });
    }

    if (query.search) {
      filters.push({
        OR: [
          { title: { contains: query.search, mode: 'insensitive' } },
          { description: { contains: query.search, mode: 'insensitive' } },
          { category: { contains: query.search, mode: 'insensitive' } },
          { subcategory: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }

    const sortBy = query.sortBy ?? 'created';
    const sortOrder = query.order ?? query.sortOrder ?? 'desc';
    const orderBy =
      sortBy === 'rating'
        ? { rating: sortOrder }
        : sortBy === 'price'
          ? { minPrice: sortOrder }
          : sortBy === 'reviews'
            ? { reviewCount: sortOrder }
            : sortBy === 'createdAt'
              ? { createdAt: sortOrder }
            : { createdAt: sortOrder };

    const where = {
      status: query.status ?? 'ACTIVE',
      ...(filters.length > 0 ? { AND: filters } : {}),
    };

    const data = await this.prisma.agent.findMany({
      where,
      skip,
      take: limit,
      orderBy,
    });
    const total = await this.prisma.agent.count({ where });

    return { data, total, page, limit };
  }

  async findOne(id: number) {
    const agent = await this.prisma.agent.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            walletAddress: true,
            name: true,
            email: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!agent) {
      throw new NotFoundException(`Agent #${id} not found`);
    }

    return agent;
  }

  async findMine(userId: number) {
    return this.prisma.agent.findMany({
      where: { ownerId: userId },
      include: {
        owner: {
          select: {
            id: true,
            walletAddress: true,
            name: true,
            email: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
  }

  async update(id: number, userId: number, updateAgentDto: UpdateAgentDto) {
    const existingAgent = await this.prisma.agent.findUnique({
      where: { id },
    });

    if (!existingAgent) {
      throw new NotFoundException(`Agent #${id} not found`);
    }

    if (existingAgent.ownerId !== userId) {
      throw new ForbiddenException('You are not the owner of this agent');
    }

    const data: Record<string, unknown> = {
      name: updateAgentDto.name ?? updateAgentDto.title,
      description: updateAgentDto.description,
      shortDesc: updateAgentDto.shortDesc,
      category: updateAgentDto.category
        ? this.toAgentCategory(updateAgentDto.category)
        : undefined,
      tags: updateAgentDto.tags,
      status:
        updateAgentDto.isActive === undefined
          ? undefined
          : updateAgentDto.isActive
            ? 'ACTIVE'
            : 'PAUSED',
      availability: updateAgentDto.isActive,
    };

    const configUpdates: Record<string, unknown> = {};

    if (updateAgentDto.subcategory !== undefined) {
      configUpdates.subcategory = updateAgentDto.subcategory;
    }

    if (updateAgentDto.location) {
      configUpdates.location = updateAgentDto.location;
    }

    if (updateAgentDto.services) {
      configUpdates.services = updateAgentDto.services;
      data.capabilities = updateAgentDto.services.map((service) => service.name);
    }

    if (updateAgentDto.pricing) {
      configUpdates.pricing = updateAgentDto.pricing;
    }

    if (updateAgentDto.endpointUrl !== undefined) {
      data.endpointUrl = updateAgentDto.endpointUrl;
    }

    if (updateAgentDto.endpointAuthType !== undefined) {
      data.endpointAuthType = updateAgentDto.endpointAuthType;
    }

    if (updateAgentDto.timeoutMs !== undefined) {
      data.timeoutMs = updateAgentDto.timeoutMs;
    }

    if (updateAgentDto.secretKey !== undefined) {
      data.secretKey = updateAgentDto.secretKey;
    }

    if (updateAgentDto.availability) {
      configUpdates.availability = updateAgentDto.availability;
    }

    if (updateAgentDto.responseTime !== undefined) {
      configUpdates.responseTime = updateAgentDto.responseTime;
    }

    if (updateAgentDto.languages) {
      configUpdates.languages = updateAgentDto.languages;
    }

    if (updateAgentDto.capabilities !== undefined) {
      data.capabilities = updateAgentDto.capabilities;
    }

    if (Object.keys(configUpdates).length > 0) {
      data.configuration = this.toJsonValue({
        ...this.getJsonObject(existingAgent.configuration),
        ...configUpdates,
      });
    }

    if (updateAgentDto.services || updateAgentDto.pricing) {
      const nextServices = updateAgentDto.services ?? [];
      const nextPricing = updateAgentDto.pricing ?? [];
      const priceRange = this.calculatePriceRange(nextPricing, nextServices);
      data.minPrice = priceRange.minPrice;
      data.maxPrice = priceRange.maxPrice;
    }

    return this.prisma.agent.update({
      where: { id },
      data,
      include: {
        owner: {
          select: {
            id: true,
            walletAddress: true,
            name: true,
            email: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
  }

  async remove(id: number, userId: number) {
    const existingAgent = await this.prisma.agent.findUnique({
      where: { id },
      select: { id: true, ownerId: true },
    });

    if (!existingAgent) {
      throw new NotFoundException(`Agent #${id} not found`);
    }

    if (existingAgent.ownerId !== userId) {
      throw new ForbiddenException('You are not the owner of this agent');
    }

    await this.prisma.agent.delete({
      where: { id },
    });

    return { success: true };
  }

  async getCategoryStats(
    status: 'DRAFT' | 'ACTIVE' | 'MINTED' | 'PAUSED' | 'ARCHIVED' = 'ACTIVE',
  ) {
    const groups = await this.prisma.agent.groupBy({
      by: ['category'],
      where: { status },
      _count: { id: true },
    });

    return groups.map((item) => ({
      category: item.category,
      count: item._count?.id ?? 0,
    }));
  }

  async getTags(status: 'DRAFT' | 'ACTIVE' | 'MINTED' | 'PAUSED' | 'ARCHIVED' = 'ACTIVE') {
    const agents = await this.prisma.agent.findMany({
      where: { status },
      select: { tags: true },
    });

    const counts = new Map<string, number>();
    for (const agent of agents) {
      for (const tag of agent.tags ?? []) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }

    return Array.from(counts.entries()).map(([tag, count]) => ({
      tag,
      count,
    }));
  }
}
