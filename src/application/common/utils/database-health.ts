import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { MikroORM } from '@mikro-orm/core';

export interface DatabaseConnectionStatus {
  postgres: {
    connected: boolean;
    message: string;
    error?: string;
  };
  redis: {
    connected: boolean;
    message: string;
    error?: string;
  };
  sqlServer: {
    connected: boolean;
    message: string;
    error?: string;
  };
}

/**
 * Utility service to check database connections and display status
 */
@Injectable()
export class DatabaseHealthService {
  private readonly logger = new Logger(DatabaseHealthService.name);

  constructor(
    private prismaService: PrismaService,
    private orm: MikroORM
  ) {}

  /**
   * Check PostgreSQL connection (MikroORM)
   */
  async checkPostgresConnection(): Promise<{ connected: boolean; error?: string }> {
    try {
      // Check if ORM is initialized
      if (!this.orm.isConnected()) {
        return { connected: false, error: 'ORM not initialized' };
      }

      // Try a simple query
      const em = this.orm.em.fork();
      const result = await em.getConnection().execute('SELECT 1');
      
      return { connected: !!result };
    } catch (error: any) {
      return { connected: false, error: error.message };
    }
  }

  /**
   * Check SQL Server connection (Prisma)
   */
  async checkSqlServerConnection(): Promise<{ connected: boolean; error?: string }> {
    try {
      // Try a simple raw query
      const result = await this.prismaService.$queryRaw`SELECT 1`;
      return { connected: !!result };
    } catch (error: any) {
      return { connected: false, error: error.message };
    }
  }

  /**
   * Check Redis connection (via BullMQ or Redis client)
   */
  async checkRedisConnection(): Promise<{ connected: boolean; error?: string }> {
    try {
      // Try to import and use redis client directly
      const redis = require('redis');
      const client = redis.createClient({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379')
      });

      await client.connect();
      const pong = await client.ping();
      await client.quit();

      return { connected: pong === 'PONG' };
    } catch (error: any) {
      return { connected: false, error: error.message };
    }
  }

  /**
   * Check all database connections
   */
  async checkAllConnections(): Promise<DatabaseConnectionStatus> {
    const [postgresResult, sqlServerResult, redisResult] = await Promise.all([
      this.checkPostgresConnection(),
      this.checkSqlServerConnection(),
      this.checkRedisConnection()
    ]);

    return {
      postgres: {
        connected: postgresResult.connected,
        message: postgresResult.connected ? 'Connected' : `Failed: ${postgresResult.error}`,
        error: postgresResult.error
      },
      sqlServer: {
        connected: sqlServerResult.connected,
        message: sqlServerResult.connected ? 'Connected' : `Failed: ${sqlServerResult.error}`,
        error: sqlServerResult.error
      },
      redis: {
        connected: redisResult.connected,
        message: redisResult.connected ? 'Connected' : `Failed: ${redisResult.error}`,
        error: redisResult.error
      }
    };
  }

  /**
   * Display formatted connection status
   */
  async displayConnectionStatus(): Promise<DatabaseConnectionStatus> {
    const status = await this.checkAllConnections();

    const statusLine = (name: string, connected: boolean, message: string) => {
      const symbol = connected ? '✓' : '✗';
      const color = connected ? '\x1b[32m' : '\x1b[31m'; // Green or Red
      const reset = '\x1b[0m';
      return `${color}${symbol}${reset} ${name}: ${message}`;
    };

    console.log('\n════════════════════════════════════════════════════════════');
    console.log('  Database Connection Status');
    console.log('════════════════════════════════════════════════════════════');
    console.log(statusLine('PostgreSQL (MikroORM)', status.postgres.connected, status.postgres.message));
    console.log(statusLine('SQL Server (Prisma)', status.sqlServer.connected, status.sqlServer.message));
    console.log(statusLine('Redis (BullMQ)', status.redis.connected, status.redis.message));
    console.log('════════════════════════════════════════════════════════════\n');

    // Log using logger too
    this.logger.log(`PostgreSQL: ${status.postgres.message}`);
    this.logger.log(`SQL Server: ${status.sqlServer.message}`);
    this.logger.log(`Redis: ${status.redis.message}`);

    return status;
  }
}
