import {
  IsString,
  IsEmail,
  IsOptional,
  IsEthereumAddress,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({
    description: '钱包地址',
    example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  })
  @IsEthereumAddress()
  readonly walletAddress: string;

  @ApiPropertyOptional({ description: '用户名', example: 'John Doe' })
  @IsOptional()
  @IsString()
  readonly name?: string;

  @ApiPropertyOptional({ description: '邮箱地址', example: 'user@example.com' })
  @IsOptional()
  @IsEmail()
  readonly email?: string;
}
