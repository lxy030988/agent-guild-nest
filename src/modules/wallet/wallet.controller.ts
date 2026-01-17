import { Controller, Get, UseGuards, Req, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WalletService } from './wallet.service';

@ApiTags('wallet')
@Controller('wallet')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('overview')
  @ApiOperation({ summary: '获取资产概览' })
  async getOverview(@Req() req) {
    return this.walletService.getWalletOverview(req.user.userId);
  }

  @Get('earnings')
  @ApiOperation({ summary: '获取收益统计' })
  async getEarnings(@Req() req) {
    return this.walletService.getEarnings(req.user.userId);
  }

  @Get('transactions')
  @ApiOperation({ summary: '获取交易历史' })
  async getTransactions(
    @Req() req,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.walletService.getTransactionHistory(
      req.user.userId,
      page,
      limit,
    );
  }

  @Get('trends')
  @ApiOperation({ summary: '获取资产趋势' })
  async getTrends(@Req() req, @Query('days') days: number = 30) {
    return this.walletService.getAssetTrends(req.user.userId, days);
  }
}
