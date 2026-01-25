import { Module } from '@nestjs/common';
import { AppController } from './api/controllers/app.controller';
import { AppService } from './app.service';
import { AutomapperModule } from '@automapper/nestjs';
import { classes } from '@automapper/classes';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import defineConfig from '../mikro-orm.config';
import { ProviderModule } from './infrastructure/modules/provider.module';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthGuard } from './application/common/auth/AuthGuard';
import { APP_GUARD } from '@nestjs/core';
@Module({
  imports: [
    AutomapperModule.forRoot({
      strategyInitializer: classes()
    }),
    MikroOrmModule.forRoot({
      ...defineConfig,
      autoLoadEntities: true
    }),
    ConfigModule.forRoot(),
    ProviderModule,
    JwtModule.register({
      global: true,
      secret: process.env.PUBLIC_KEY,
      signOptions: { algorithm: 'RS256' }
    })
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard
    }
  ]
})
export class AppModule {}
