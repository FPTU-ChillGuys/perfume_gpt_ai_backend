import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { HttpExceptionFilter } from './application/filters/http-error-handler.filter';
import { MikroORM } from '@mikro-orm/core';
import { seedAdminInstructions } from './infrastructure/seed/admin-instruction.seeder';
import { execSync } from 'child_process';

/** Tạm thời: chạy migration bằng CLI trực tiếp */
function runMigrationCLI(): void {
  try {
    console.log('[MikroORM] Đang chạy npx mikro-orm migration:up ...');
    const output = execSync('npx mikro-orm migration:up', {
      cwd: process.cwd(),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    console.log('[MikroORM] Migration CLI output:\n', output);
  } catch (error: any) {
    console.error('[MikroORM] Migration CLI thất bại:', error.stderr || error.message);
    throw error;
  }
}

async function bootstrap() {
  // Chạy migration trước khi khởi tạo NestJS app
  runMigrationCLI();

  const app = await NestFactory.create(AppModule, { cors: true });

  // Seed dữ liệu mặc định cho admin instructions (idempotent)
  try {
    const orm = app.get(MikroORM);
    await seedAdminInstructions(orm);
  } catch (error) {
    console.error('[MikroORM] Seed thất bại:', error);
  }

  const config = new DocumentBuilder()
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        in: 'header',
        name: 'Authorization'
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

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
