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

    // 从 connection string 解析并处理 SSL 参数
    const url = new URL(connectionString);
    const sslmode = url.searchParams.get('sslmode');
    url.searchParams.delete('sslmode');

    // 默认对本地数据库禁用 SSL；远程默认启用
    const isLocal =
      url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    const useSSL =
      sslmode === 'require' ||
      sslmode === 'verify-full' ||
      sslmode === 'verify-ca' ||
      (sslmode === null && !isLocal);

    const pool = new Pool({
      connectionString: url.toString(),
      ssl: useSSL ? { rejectUnauthorized: false } : false,
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
