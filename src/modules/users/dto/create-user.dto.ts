import {
  IsString,
  IsEmail,
  IsOptional,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ description: '用户名', example: 'John Doe' })
  @IsString()
  readonly name: string;

  @ApiProperty({ description: '邮箱地址', example: 'user@example.com' })
  @IsEmail()
  readonly email: string;
}
