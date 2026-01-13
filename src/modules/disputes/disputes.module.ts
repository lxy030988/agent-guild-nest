import { Module } from '@nestjs/common';
import { DisputesService } from './disputes.service';
import { DisputesController } from './disputes.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { BillsModule } from '../bills/bills.module';

@Module({
  imports: [PrismaModule, BillsModule],
  controllers: [DisputesController],
  providers: [DisputesService],
  exports: [DisputesService],
})
export class DisputesModule {}
