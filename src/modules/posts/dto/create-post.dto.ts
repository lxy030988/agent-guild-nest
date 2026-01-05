import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePostDto {
  @ApiProperty({ description: '文章标题', example: '我的第一篇文章' })
  @IsString()
  @IsNotEmpty()
  readonly title: string;

  @ApiPropertyOptional({
    description: '文章内容',
    example: '这是文章的详细内容...',
  })
  @IsString()
  @IsOptional()
  readonly content?: string;

  @ApiProperty({ description: '作者ID', example: 1 })
  @IsInt()
  readonly authorId: number;

  @ApiPropertyOptional({
    description: '是否发布',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  readonly published?: boolean;
}
