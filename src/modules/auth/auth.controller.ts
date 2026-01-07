import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { GetNonceDto, Web3LoginDto } from './dto/auth.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('认证')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('nonce')
  @ApiOperation({ summary: '获取签名用的 Nonce' })
  @ApiResponse({ status: 200, description: '返回 nonce 和待签名消息' })
  async getNonce(@Body() getNonceDto: GetNonceDto) {
    return this.authService.getNonce(getNonceDto.walletAddress);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Web3 钱包登录' })
  @ApiResponse({ status: 200, description: '返回 JWT Token 和用户信息' })
  @ApiResponse({ status: 401, description: '签名验证失败' })
  async web3Login(@Body() loginDto: Web3LoginDto) {
    return this.authService.web3Login(
      loginDto.walletAddress,
      loginDto.signature,
    );
  }

  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前用户信息' })
  @ApiResponse({ status: 200, description: '返回用户信息' })
  @ApiResponse({ status: 401, description: '未授权' })
  async getProfile(@CurrentUser() user: any) {
    return this.authService.getProfile(user.userId);
  }
}
