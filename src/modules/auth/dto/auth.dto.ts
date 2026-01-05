import { IsEthereumAddress, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 获取 Nonce 的请求 DTO
 */
export class GetNonceDto {
  @ApiProperty({
    description: '钱包地址',
    example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  })
  @IsEthereumAddress({ message: '请提供有效的以太坊地址' })
  @IsNotEmpty()
  walletAddress: string;
}

/**
 * Web3 登录请求 DTO
 */
export class Web3LoginDto {
  @ApiProperty({
    description: '钱包地址',
    example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  })
  @IsEthereumAddress({ message: '请提供有效的以太坊地址' })
  @IsNotEmpty()
  walletAddress: string;

  @ApiProperty({
    description: '钱包签名',
    example: '0x...',
  })
  @IsString()
  @IsNotEmpty()
  signature: string;
}
