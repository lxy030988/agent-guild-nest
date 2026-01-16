import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import {
  WalletOverviewDto,
  StakingStatusDto,
  TransactionDto,
  GetTransactionsQueryDto,
} from './dto/wallet.dto';

@ApiTags('wallet')
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('overview/:address')
  @ApiOperation({ summary: '获取钱包概览数据' })
  @ApiResponse({ status: 200, description: '返回钱包概览', type: WalletOverviewDto })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  async getWalletOverview(
    @Param('address') walletAddress: string,
  ): Promise<WalletOverviewDto> {
    return this.walletService.getWalletOverview(walletAddress);
  }

  @Get('staking/:address')
  @ApiOperation({ summary: '获取质押状态' })
  @ApiResponse({ status: 200, description: '返回质押状态', type: StakingStatusDto })
  async getStakingStatus(
    @Param('address') walletAddress: string,
  ): Promise<StakingStatusDto> {
    return this.walletService.getStakingStatus(walletAddress);
  }

  @Get('transactions/:address')
  @ApiOperation({ summary: '获取交易历史' })
  @ApiResponse({ status: 200, description: '返回交易列表' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'timeFilter', required: false, enum: ['24h', '7d', '30d', 'all'] })
  @ApiQuery({ name: 'type', required: false, enum: ['stake', 'unstake', 'claim', 'earn', 'escrow'] })
  async getTransactions(
    @Param('address') walletAddress: string,
    @Query() query: GetTransactionsQueryDto,
  ): Promise<{ data: TransactionDto[]; total: number; page: number; limit: number }> {
    return this.walletService.getTransactions(walletAddress, query);
  }

  @Post('transactions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建交易记录' })
  @ApiResponse({ status: 201, description: '交易创建成功', type: TransactionDto })
  async createTransaction(
    @Body(ValidationPipe) body: {
      walletAddress: string;
      type: TransactionDto['type'];
      title: string;
      description: string;
      amount: string;
      currency: string;
      txHash?: string;
    },
  ): Promise<TransactionDto> {
    return this.walletService.createTransaction(body.walletAddress, {
      type: body.type,
      title: body.title,
      description: body.description,
      amount: body.amount,
      currency: body.currency,
      txHash: body.txHash,
    });
  }
}
