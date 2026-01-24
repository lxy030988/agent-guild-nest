import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsUrl,
  IsInt,
  IsBoolean,
  MinLength,
  MaxLength,
  Min,
  Max,
  ArrayMaxSize,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * Agent 分类枚举
 */
export enum AgentCategory {
  PRODUCTIVITY_TOOLS = 'PRODUCTIVITY_TOOLS',
  CREATIVE_ASSISTANTS = 'CREATIVE_ASSISTANTS',
  DEVELOPER_TOOLS = 'DEVELOPER_TOOLS',
  OTHERS = 'OTHERS',
}

/**
 * Agent 端点认证类型
 */
export enum EndpointAuthType {
  PUBLIC = 'public', // 公开接口，无需认证
  BEARER = 'bearer', // Bearer Token 认证
  API_KEY = 'api-key', // API Key 认证
}

/**
 * 创建 Agent DTO
 */
export class CreateAgentDto {
  @ApiProperty({ description: 'Agent 名称', example: 'Code Review Bot' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Agent 详细描述',
    example:
      'AI-powered code review assistant for JavaScript/TypeScript projects',
  })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  description: string;

  @ApiPropertyOptional({
    description: '简短描述（用于卡片展示）',
    example: 'Automated code review',
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  shortDesc?: string;

  @ApiPropertyOptional({
    description: 'Agent 头像 URL',
    example: 'https://example.com/avatar.png',
  })
  @IsOptional()
  @IsUrl()
  avatar?: string;

  @ApiProperty({
    description: 'Agent 分类',
    enum: AgentCategory,
    example: AgentCategory.DEVELOPER_TOOLS,
  })
  @IsEnum(AgentCategory)
  category: AgentCategory;

  @ApiProperty({
    description: '标签列表（1-10 个标签，每个最多 20 字符）',
    example: ['code-review', 'javascript', 'typescript'],
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @MaxLength(20, { each: true })
  tags: string[];

  @ApiPropertyOptional({
    description: '能力列表',
    example: ['code-review', 'bug-detection', 'security-scan'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  capabilities?: string[];

  @ApiProperty({
    description: 'Agent API 端点 URL',
    example: 'https://my-agent.vercel.app/api/v1/execute',
  })
  @IsUrl()
  endpointUrl: string;

  @ApiPropertyOptional({
    description: 'Endpoint 认证类型',
    enum: EndpointAuthType,
    default: EndpointAuthType.PUBLIC,
  })
  @IsOptional()
  @IsEnum(EndpointAuthType)
  endpointAuthType?: EndpointAuthType;

  @ApiPropertyOptional({
    description: '健康检查端点 URL',
    example: 'https://my-agent.vercel.app/api/health',
  })
  @IsOptional()
  @IsUrl()
  healthCheckUrl?: string;

  @ApiPropertyOptional({
    description: '超时时间（毫秒）',
    example: 30000,
    default: 30000,
  })
  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(300000)
  timeoutMs?: number;

  @ApiPropertyOptional({
    description: 'Agent 配置（JSON）',
    example: { maxConcurrentJobs: 5 },
  })
  @IsOptional()
  configuration?: Record<string, any>;

  @ApiPropertyOptional({
    description: '输入规范（JSON Schema）',
  })
  @IsOptional()
  inputSchema?: Record<string, any>;

  @ApiPropertyOptional({
    description: '输出规范（JSON Schema）',
  })
  @IsOptional()
  outputSchema?: Record<string, any>;
}
