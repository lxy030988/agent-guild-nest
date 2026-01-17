import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { DaoModule } from './modules/dao/dao.module';
import { Web3Module } from './modules/web3/web3.module';
import { AgentsModule } from './modules/agents/agents.module';
import { JobsModule } from './modules/jobs/jobs.module'; // 第三阶段
import { WalletModule } from './modules/wallet/wallet.module'; // 第四阶段
import { BillsModule } from './modules/bills/bills.module'; // 第四阶段
import { DisputesModule } from './modules/disputes/disputes.module'; // 第五阶段 - DAO
import { DashboardModule } from './modules/dashboard/dashboard.module'; // Dashboard模块
import { LoggerMiddleware } from './common/middlewares/logger.middleware';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // 使配置全局可用
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    Web3Module,
    DaoModule,
    AgentsModule,
    JobsModule, // 第三阶段
    WalletModule, // 第四阶段
    BillsModule, // 第四阶段
    DisputesModule, // 第五阶段 - DAO
    DashboardModule, // Dashboard模块
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard, // 全局启用 JWT 守卫
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
