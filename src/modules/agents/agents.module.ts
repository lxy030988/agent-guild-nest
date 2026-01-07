import { Module } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { AgentsController } from './agents.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AgentsController],
  providers: [AgentsService],
  exports: [AgentsService], // 导出供其他模块使用（第三阶段 Jobs 模块需要）
})
export class AgentsModule {}
