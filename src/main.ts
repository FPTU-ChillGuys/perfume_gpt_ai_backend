import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { MikroORM } from '@mikro-orm/core';
import { seedAdminInstructions } from './infrastructure/domain/common/seed/admin-instruction.seeder';
import { execSync } from 'child_process';
import { HttpExceptionFilter } from './application/filters/http-exception.filter';
import { SuccessResponseInterceptor } from './application/common/interceptors/success-response.interceptor';
import { ValidationPipe, Logger } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { createClient } from '@keyv/redis';

const logger = new Logger('Bootstrap');
/**
 * Check and display database connection status
 */
async function displayDatabaseStatus(app: any): Promise<void> {
  const orm = app.get(MikroORM);
  const prismaService = app.get(PrismaService);

  const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    bright: '\x1b[1m'
  };

  const statusLine = (
    name: string,
    connected: boolean,
    message: string = ''
  ) => {
    const symbol = connected ? '✓' : '✗';
    const color = connected ? colors.green : colors.red;
    const msg = message ? ` - ${message}` : '';
    console.log(`${color}${symbol}${colors.reset} ${name}${msg}`);
  };

  console.log(
    `\n${colors.bright}${colors.cyan}════════════════════════════════════════════════════════════`
  );
  console.log(`  Database Connection Status`);
  console.log(
    `════════════════════════════════════════════════════════════${colors.reset}`
  );

  // PostgreSQL (MikroORM)
  try {
    const isConnected = orm.isConnected();
    statusLine('PostgreSQL (MikroORM)', isConnected);
  } catch (error: any) {
    statusLine('PostgreSQL (MikroORM)', false, error.message);
  }

  // SQL Server (Prisma)
  try {
    await prismaService.$queryRaw`SELECT 1`;
    statusLine('SQL Server (Prisma)', true);
  } catch (error: any) {
    statusLine('SQL Server (Prisma)', false, error.message);
  }

  // Redis (BullMQ)
  try {
    const client = createClient({
      url: `redis://${process.env.REDIS_HOST ?? 'localhost'}:${process.env.REDIS_PORT ?? '6379'}`
    });
    await client.connect();
    const pong = await client.ping();
    await client.quit();
    statusLine('Redis (BullMQ)', pong === 'PONG');
  } catch (error: any) {
    statusLine('Redis (BullMQ)', false, error.message);
  }

  console.log(
    `${colors.bright}${colors.cyan}════════════════════════════════════════════════════════════${colors.reset}\n`
  );
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });

  // Seed dữ liệu mặc định cho admin instructions (idempotent)
  try {
    const orm = app.get(MikroORM);
    await seedAdminInstructions(orm);
  } catch (error) {
    console.error('[MikroORM] Seed thất bại:', error);
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      skipMissingProperties: false // Bắt buộc properties nếu dùng validation decorator
    })
  );

  const config = new DocumentBuilder()
    .setTitle('PerfumeGPT AI Backend')
    .setDescription(
      `API backend cho hệ thống PerfumeGPT AI.\n\n` +
        `## Xác thực (Authentication)\n` +
        `- Các endpoint **không có biểu tượng 🔒** là **public**, không cần token.\n` +
        `- Các endpoint **có biểu tượng 🔒** yêu cầu **Bearer JWT token** trong header \`Authorization\`.\n` +
        `- Một số endpoint yêu cầu role **admin** — sẽ trả về **403 Forbidden** nếu không đủ quyền.\n\n` +
        `## Cách xác thực trong Scalar\n` +
        `1. Tìm phần **Authentication** ở đầu trang hoặc click biểu tượng 🔒 cạnh endpoint.\n` +
        `2. Chọn scheme **Bearer Token** và nhập JWT token vào ô **Token**.\n` +
        `3. Các request sẽ tự động gửi kèm header \`Authorization: Bearer <token>\`.`
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        in: 'header',
        name: 'Authorization',
        description:
          'Nhập JWT token để xác thực. Một số endpoint yêu cầu role admin.'
      },
      'jwt' // tên security
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);

  app.use(
    '/reference',
    apiReference({
      content: document
    })
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new SuccessResponseInterceptor());

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  // Display database connection status after app starts
  try {
    await displayDatabaseStatus(app);
    logger.log(`Application is running on: http://localhost:${port}`);
  } catch (error) {
    logger.warn('Could not display database status');
  }
}
bootstrap();
