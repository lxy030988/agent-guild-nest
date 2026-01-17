import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { AgentQueryDto } from './dto/agent-query.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';

const baseCreateDto: CreateAgentDto = {
  title: 'AI Consulting',
  description: 'AI strategy and delivery',
  category: 'AI',
  subcategory: 'LLM',
  location: {
    city: 'Shanghai',
    country: 'CN',
    isRemote: true,
  },
  services: [
    {
      name: 'Discovery',
      description: 'Scope and requirements',
      duration: 60,
      price: 199,
      currency: 'USD',
    },
  ],
  pricing: [
    {
      name: 'Base',
      price: 299,
      currency: 'USD',
      unit: 'hour',
    },
  ],
  availability: {
    timezone: 'Asia/Shanghai',
    schedule: {
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: [],
    },
  },
  responseTime: '< 1 hour',
  languages: ['zh-CN'],
  tags: ['AI'],
  isActive: true,
};

describe('AgentsService', () => {
  let service: AgentsService;
  const prisma = {
    agent: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AgentsService(prisma as any);
  });

  it('throws when creating a second agent for the same user', async () => {
    prisma.agent.findFirst.mockResolvedValue({ id: 1 });

    await expect(service.create(10, baseCreateDto)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('creates agent with derived price range', async () => {
    prisma.agent.findFirst.mockResolvedValue(null);
    prisma.agent.create.mockResolvedValue({ id: 1 });

    await service.create(10, baseCreateDto);

    expect(prisma.agent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          minPrice: 199,
          maxPrice: 299,
        }),
      }),
    );
  });

  it('returns paginated agents with filters', async () => {
    prisma.$transaction.mockResolvedValue([[], 0]);

    const query: AgentQueryDto = {
      category: 'AI',
      location: 'shanghai',
      minRating: 4,
      minPrice: 100,
      maxPrice: 500,
      sortBy: 'rating',
      sortOrder: 'desc',
      page: 1,
      limit: 10,
      search: 'consulting',
    };

    const result = await service.findAll(query);

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(result).toEqual({ data: [], total: 0, page: 1, limit: 10 });
  });

  it('rejects update when agent is missing', async () => {
    prisma.agent.findUnique.mockResolvedValue(null);

    await expect(
      service.update(1, 1, { title: 'Next' } as UpdateAgentDto),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects update when not owner', async () => {
    prisma.agent.findUnique.mockResolvedValue({ id: 1, userId: 2 });

    await expect(
      service.update(1, 1, { title: 'Next' } as UpdateAgentDto),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
