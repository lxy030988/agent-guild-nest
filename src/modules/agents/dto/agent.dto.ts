import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum Currency {
  USD = 'USD',
  ETH = 'ETH',
}

export enum PricingUnit {
  HOUR = 'hour',
  JOB = 'job',
  DAY = 'day',
}

export class CoordinatesDto {
  @ApiProperty({ description: '纬度', example: 40.7128 })
  @IsNumber()
  lat: number;

  @ApiProperty({ description: '经度', example: -74.006 })
  @IsNumber()
  lng: number;
}

export class LocationDto {
  @ApiProperty({ description: '城市', example: 'Shanghai' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ description: '国家', example: 'CN' })
  @IsString()
  @IsNotEmpty()
  country: string;

  @ApiPropertyOptional({ description: '坐标' })
  @IsOptional()
  @ValidateNested()
  @Type(() => CoordinatesDto)
  coordinates?: CoordinatesDto;

  @ApiProperty({ description: '是否支持远程服务', example: true })
  @IsBoolean()
  isRemote: boolean;
}

export class ServiceDto {
  @ApiPropertyOptional({ description: '服务 ID (更新时可传)' })
  @IsOptional()
  @IsInt()
  id?: number;

  @ApiProperty({ description: '服务名称', example: 'AI 咨询' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: '服务描述', example: '面向企业的 AI 方案咨询' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ description: '时长 (分钟)', example: 60 })
  @IsInt()
  @Min(1)
  duration: number;

  @ApiProperty({ description: '价格', example: 199 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ description: '币种', enum: Currency })
  @IsEnum(Currency)
  currency: Currency;
}

export class PricingDto {
  @ApiPropertyOptional({ description: '定价 ID (更新时可传)' })
  @IsOptional()
  @IsInt()
  id?: number;

  @ApiProperty({ description: '定价名称', example: '基础套餐' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: '价格', example: 299 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ description: '币种', enum: Currency })
  @IsEnum(Currency)
  currency: Currency;

  @ApiProperty({ description: '计价单位', enum: PricingUnit })
  @IsEnum(PricingUnit)
  unit: PricingUnit;

  @ApiPropertyOptional({ description: '定价描述', example: '标准交付' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class TimeSlotDto {
  @ApiProperty({ description: '开始时间', example: '09:00' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  start: string;

  @ApiProperty({ description: '结束时间', example: '18:00' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  end: string;
}

export class WeeklyScheduleDto {
  @ApiProperty({ type: [TimeSlotDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeSlotDto)
  monday: TimeSlotDto[];

  @ApiProperty({ type: [TimeSlotDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeSlotDto)
  tuesday: TimeSlotDto[];

  @ApiProperty({ type: [TimeSlotDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeSlotDto)
  wednesday: TimeSlotDto[];

  @ApiProperty({ type: [TimeSlotDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeSlotDto)
  thursday: TimeSlotDto[];

  @ApiProperty({ type: [TimeSlotDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeSlotDto)
  friday: TimeSlotDto[];

  @ApiProperty({ type: [TimeSlotDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeSlotDto)
  saturday: TimeSlotDto[];

  @ApiProperty({ type: [TimeSlotDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeSlotDto)
  sunday: TimeSlotDto[];
}

export class DateExceptionDto {
  @ApiProperty({ description: '异常日期', example: '2026-01-20' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({ type: [TimeSlotDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeSlotDto)
  slots?: TimeSlotDto[];
}

export class AvailabilityDto {
  @ApiProperty({ description: '时区', example: 'Asia/Shanghai' })
  @IsString()
  @IsNotEmpty()
  timezone: string;

  @ApiProperty({ type: WeeklyScheduleDto })
  @ValidateNested()
  @Type(() => WeeklyScheduleDto)
  schedule: WeeklyScheduleDto;

  @ApiPropertyOptional({ type: [DateExceptionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DateExceptionDto)
  exceptions?: DateExceptionDto[];
}

export class AgentBaseDto {
  @ApiProperty({ description: '服务标题', example: 'AI 应用落地咨询' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: '服务描述',
    example: '提供全流程 AI 产品落地服务',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ description: '服务类别', example: 'AI Consulting' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiPropertyOptional({ description: '子类别', example: 'LLM' })
  @IsOptional()
  @IsString()
  subcategory?: string;

  @ApiProperty({ type: LocationDto })
  @ValidateNested()
  @Type(() => LocationDto)
  location: LocationDto;

  @ApiProperty({ type: [ServiceDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ServiceDto)
  services: ServiceDto[];

  @ApiProperty({ type: [PricingDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PricingDto)
  pricing: PricingDto[];

  @ApiProperty({ type: AvailabilityDto })
  @ValidateNested()
  @Type(() => AvailabilityDto)
  availability: AvailabilityDto;

  @ApiProperty({ description: '响应时间描述', example: '< 1 hour' })
  @IsString()
  @IsNotEmpty()
  responseTime: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  languages: string[];

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  tags: string[];

  @ApiPropertyOptional({ description: '是否启用', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
