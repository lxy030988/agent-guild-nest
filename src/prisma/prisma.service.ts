import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

/**
 * Prisma Service
 * 管理 Prisma Client 的生命周期和数据库连接
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // Prisma 7.x 需要 adapter
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not defined');
    }

    // 从 connection string 解析并移除可能冲突的 SSL 参数
    const url = new URL(connectionString);
    url.searchParams.delete('sslmode'); // 移除 sslmode 参数，我们会通过 Pool 配置 SSL

    const pool = new Pool({
      connectionString: url.toString(),
      ssl: {
        rejectUnauthorized: false, // AWS RDS 需要 SSL 但不验证证书
      },
    });
    const adapter = new PrismaPg(pool);

    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
    console.log('✅ Database connected successfully');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
