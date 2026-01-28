import { Module } from '@nestjs/common';
import { AppController } from './api/controllers/app.controller';
import { AppService } from './app.service';
import { AutomapperModule } from '@automapper/nestjs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import defineConfig from '../mikro-orm.config';
import { ProviderModule } from './infrastructure/modules/provider.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthGuard } from './application/common/auth/AuthGuard';
import { APP_GUARD } from '@nestjs/core';
import * as fs from 'fs';
import { mikro } from '@automapper/mikro';
import { CamelCaseNamingConvention } from '@automapper/core';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AutomapperModule.forRoot({
      strategyInitializer: mikro(),
      namingConventions: new CamelCaseNamingConvention()
    }),
    ProviderModule,
    MikroOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async () => {
        const config = await defineConfig();
        return {
          ...config
        };
      }
    }),

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        publicKey: fs.readFileSync('public_key.pem', 'utf8'),
        verifyOptions: {
          algorithms: ['RS256'],
          issuer: config.get<string>('JWT_ISSUER'),
          audience: config.get<string>('JWT_AUDIENCE')
        }
      })
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
