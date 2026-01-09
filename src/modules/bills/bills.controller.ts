import { Controller, Get, Param, UseGuards, Req, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BillsService } from './bills.service';

@ApiTags('bills')
@Controller('bills')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BillsController {
  constructor(private readonly billsService: BillsService) {}

  @Get()
  @ApiOperation({ summary: '获取账单列表' })
  async getBills(
    @Req() req,
    @Query('type') type?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.billsService.getBills(req.user.userId, {
      type,
      startDate,
      endDate,
      page,
      limit,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: '获取账单详情' })
  async getBillDetail(@Param('id') id: string, @Req() req) {
    return this.billsService.getBillDetail(+id, req.user.userId);
  }
}
