import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { HttpExceptionFilter } from './application/filters/http-error-handler.filter';
import { MikroORM } from '@mikro-orm/core';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });

  // Tự động chạy migration khi khởi động - vừa cập nhật DB vừa xác nhận kết nối
  try {
    const orm = app.get(MikroORM);
    const migrator = orm.migrator;
    const pendingMigrations = await migrator.getPendingMigrations();

    if (pendingMigrations.length > 0) {
      console.log(`[MikroORM] Đang áp dụng ${pendingMigrations.length} migration(s)...`);
      await migrator.up();
      console.log('[MikroORM] Migration hoàn tất.');
    } else {
      console.log('[MikroORM] Database đã cập nhật, không có migration mới.');
    }

    console.log('[MikroORM] Kết nối database thành công.');
  } catch (error) {
    console.error('[MikroORM] Lỗi kết nối database hoặc migration thất bại:', error);
    process.exit(1);
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
