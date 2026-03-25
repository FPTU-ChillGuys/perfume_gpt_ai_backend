import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from 'generated/prisma/client';
import { PrismaMssql } from '@prisma/adapter-mssql';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const adapter = new PrismaMssql({
      server: process.env.SQL_SERVER_DATABASE_SERVER ?? 'localhost',
      port: Number(process.env.SQL_SERVER_DATABASE_PORT),
      user: process.env.SQL_SERVER_DATABASE_USER,
      password: process.env.SQL_SERVER_DATABASE_PASSWORD,
      database: process.env.SQL_SERVER_DATABASE_NAME,
      options: {
        encrypt: false,
        trustServerCertificate: true,
      },
    });

    super({ adapter });
  }

  /**
   * Khi NestJS module khởi động: kiểm tra kết nối database
   * Tương đương với MikroORM connection check khi bootstrap
   */
  async onModuleInit(): Promise<void> {
    try {
      this.logger.log('[Prisma] Đang kiểm tra kết nối database...');
      await this.$connect();
      this.logger.log('[Prisma] ✅ Kết nối database thành công!');

      // Kiểm tra thêm bằng cách ping một query đơn giản
      await this.$queryRaw`SELECT 1 AS ping`;
      this.logger.log('[Prisma] ✅ Database ping thành công!');
    } catch (error: any) {
      this.logger.error('[Prisma] ❌ Kết nối database thất bại:', error.message);
      throw error; // Dừng app nếu không kết nối được DB
    }
  }

  /**
   * Khi NestJS module tắt: đóng kết nối database
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log('[Prisma] Đang ngắt kết nối database...');
    await this.$disconnect();
    this.logger.log('[Prisma] ✅ Đã ngắt kết nối database.');
  }
}
