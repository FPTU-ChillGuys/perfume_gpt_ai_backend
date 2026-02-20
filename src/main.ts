import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { MikroORM } from '@mikro-orm/core';
import { seedAdminInstructions } from './infrastructure/seed/admin-instruction.seeder';
import { execSync } from 'child_process';
import { HttpExceptionFilter } from './application/filters/http-exception.filter';
import { SuccessResponseInterceptor } from './application/common/interceptors/success-response.interceptor';

/** Tạm thời: chạy migration bằng CLI trực tiếp */
function runMigrationCLI(): void {
  try {
    console.log('[MikroORM] Đang chạy npx mikro-orm migration:up ...');
    const output = execSync('npx mikro-orm migration:up', {
      cwd: process.cwd(),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    console.log('[MikroORM] Migration CLI output:\n', output);
  } catch (error: any) {
    console.error(
      '[MikroORM] Migration CLI thất bại:',
      error.stderr || error.message
    );
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

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
