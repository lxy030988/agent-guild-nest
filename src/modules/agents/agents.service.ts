import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
    const existingAgent = await this.prisma.agent.findFirst({
      where: { userId },
      select: { id: true },
    });

    if (existingAgent) {
      throw new ForbiddenException('Agent already exists');
    }

    const priceRange = this.calculatePriceRange(
      createAgentDto.pricing,
      createAgentDto.services,
    );

    return this.prisma.agent.create({
      data: {
        userId,
        title: createAgentDto.title,
        description: createAgentDto.description,
        category: createAgentDto.category,
        subcategory: createAgentDto.subcategory,
        location: this.toJsonValue(createAgentDto.location),
        locationCity: createAgentDto.location.city,
        locationCountry: createAgentDto.location.country,
        isRemote: createAgentDto.location.isRemote,
        services: this.toJsonValue(createAgentDto.services),
        pricing: this.toJsonValue(createAgentDto.pricing),
        availability: this.toJsonValue(createAgentDto.availability),
        responseTime: createAgentDto.responseTime,
        languages: createAgentDto.languages,
        tags: createAgentDto.tags,
        isActive: createAgentDto.isActive ?? true,
        minPrice: priceRange.minPrice,
        maxPrice: priceRange.maxPrice,
      },
      include: {
        user: {
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
    const sortOrder = query.sortOrder ?? 'desc';
    const orderBy =
      sortBy === 'rating'
        ? { rating: sortOrder }
        : sortBy === 'price'
          ? { minPrice: sortOrder }
          : sortBy === 'reviews'
            ? { reviewCount: sortOrder }
            : { createdAt: sortOrder };

    const where = {
      isActive: true,
      ...(filters.length > 0 ? { AND: filters } : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.agent.findMany({
        where,
        skip,
        take: limit,
        orderBy,
      }),
      this.prisma.agent.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: number) {
    const agent = await this.prisma.agent.findUnique({
      where: { id },
      include: {
        user: {
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
      where: { userId },
      include: {
        user: {
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

    if (existingAgent.userId !== userId) {
      throw new ForbiddenException('You are not the owner of this agent');
    }

    const data: Record<string, unknown> = {
      title: updateAgentDto.title,
      description: updateAgentDto.description,
      category: updateAgentDto.category,
      subcategory: updateAgentDto.subcategory,
      responseTime: updateAgentDto.responseTime,
      languages: updateAgentDto.languages,
      tags: updateAgentDto.tags,
      isActive: updateAgentDto.isActive,
    };

    if (updateAgentDto.location) {
      data.location = this.toJsonValue(updateAgentDto.location);
      data.locationCity = updateAgentDto.location.city;
      data.locationCountry = updateAgentDto.location.country;
      data.isRemote = updateAgentDto.location.isRemote;
    }

    if (updateAgentDto.services) {
      data.services = this.toJsonValue(updateAgentDto.services);
    }

    if (updateAgentDto.pricing) {
      data.pricing = this.toJsonValue(updateAgentDto.pricing);
    }

    if (updateAgentDto.availability) {
      data.availability = this.toJsonValue(updateAgentDto.availability);
    }

    if (updateAgentDto.services || updateAgentDto.pricing) {
      const nextServices =
        updateAgentDto.services ??
        this.getJsonArray<ServiceDto>(existingAgent.services);
      const nextPricing =
        updateAgentDto.pricing ??
        this.getJsonArray<PricingDto>(existingAgent.pricing);
      const priceRange = this.calculatePriceRange(nextPricing, nextServices);
      data.minPrice = priceRange.minPrice;
      data.maxPrice = priceRange.maxPrice;
    }

    return this.prisma.agent.update({
      where: { id },
      data,
      include: {
        user: {
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
      select: { id: true, userId: true },
    });

    if (!existingAgent) {
      throw new NotFoundException(`Agent #${id} not found`);
    }

    if (existingAgent.userId !== userId) {
      throw new ForbiddenException('You are not the owner of this agent');
    }

    await this.prisma.agent.delete({
      where: { id },
    });

    return { success: true };
  }
}
