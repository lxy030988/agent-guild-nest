import { PartialType } from '@nestjs/swagger';
import { CreateAgentDto } from './create-agent.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Agent  状态枚举
 */
export enum AgentStatus {
  DRAFT = 'DRAFT', // 草稿
  ACTIVE = 'ACTIVE', // 已发布
  MINTED = 'MINTED', // 已铸造 NFT（第四阶段）
  PAUSED = 'PAUSED', // 已暂停
  ARCHIVED = 'ARCHIVED', // 已归档
}

/**
 * 更新 Agent DTO（所有字段可选）
 */
export class UpdateAgentDto extends PartialType(CreateAgentDto) {
  @ApiPropertyOptional({
    description: 'Agent 状态',
    enum: AgentStatus,
    example: AgentStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(AgentStatus)
  status?: AgentStatus;
}
