import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Agent as PrismaAgent,
  AgentCategory as PrismaAgentCategory,
  AgentStatus as PrismaAgentStatus,
} from '@prisma/client';

/**
 * Agent Entity（用于 API 响应）
 */
export class Agent implements Partial<PrismaAgent> {
  @ApiProperty({ description: 'Agent ID' })
  id: number;

  @ApiProperty({ description: 'Agent 名称' })
  name: string;

  @ApiProperty({ description: 'Agent 详细描述' })
  description: string;

  @ApiPropertyOptional({ description: '简短描述' })
  shortDesc: string | null;

  @ApiPropertyOptional({ description: '头像 URL' })
  avatar: string | null;

  @ApiProperty({
    description: '分类',
    enum: [
      'PRODUCTIVITY_TOOLS',
      'CREATIVE_ASSISTANTS',
      'DEVELOPER_TOOLS',
      'OTHERS',
    ],
  })
  category: PrismaAgentCategory;

  @ApiProperty({ description: '标签列表' })
  tags: string[];

  @ApiProperty({
    description: '状态',
    enum: ['DRAFT', 'ACTIVE', 'MINTED', 'PAUSED', 'ARCHIVED'],
  })
  status: PrismaAgentStatus;

  @ApiProperty({ description: '能力列表' })
  capabilities: string[];

  @ApiPropertyOptional({ description: '配置 JSON' })
  configuration: any;

  @ApiProperty({ description: 'Endpoint URL' })
  endpointUrl: string;

  @ApiProperty({ description: 'Endpoint 认证类型' })
  endpointAuthType: string;

  @ApiPropertyOptional({ description: '健康检查 URL' })
  healthCheckUrl: string | null;

  @ApiProperty({ description: '超时时间（ms）' })
  timeoutMs: number;

  @ApiProperty({ description: '浏览量' })
  viewCount: number;

  @ApiProperty({ description: '评价数' })
  reviewCount: number;

  @ApiProperty({ description: '完成的任务数' })
  jobCount: number;

  @ApiPropertyOptional({ description: '评分（1-5）' })
  rating: number | null;

  @ApiProperty({ description: '是否已验证' })
  isVerified: boolean;

  @ApiProperty({ description: '健康状态' })
  healthStatus: string;

  @ApiPropertyOptional({ description: '最后健康检查时间' })
  lastHealthCheck: Date | null;

  @ApiProperty({ description: '所有者 ID' })
  ownerId: number;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;

  // 可选：包含所有者信息
  @ApiPropertyOptional({ description: '所有者信息' })
  owner?: {
    id: number;
    walletAddress: string;
    name: string | null;
  };
}
