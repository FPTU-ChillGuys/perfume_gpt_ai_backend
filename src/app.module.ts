import { Module } from '@nestjs/common';
import { AppController } from './api/controllers/app.controller';
import { AppService } from './app.service';
import { AutomapperModule } from '@automapper/nestjs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import defineConfig from '../mikro-orm.config';
import { ProviderModule } from './infrastructure/domain/common/provider.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthGuard } from './application/common/auth/AuthGuard';
import { APP_GUARD } from '@nestjs/core';
import * as fs from 'fs';
import { mikro } from '@automapper/mikro';
import { CamelCaseNamingConvention } from '@automapper/core';
import { ScheduleModule } from '@nestjs/schedule';
import { MailerModule } from '@nestjs-modules/mailer';
import { EjsAdapter } from '@nestjs-modules/mailer/dist/adapters/ejs.adapter';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './prisma/prisma.module';
import * as path from 'path';
import { NatsModule } from './infrastructure/domain/common/nats/nats.module';
import { HeaderResolver, I18nModule, QueryResolver } from 'nestjs-i18n';

@Module({
  imports: [
    PrismaModule,
    NatsModule,
    ConfigModule.forRoot({ isGlobal: true }),
    AutomapperModule.forRoot({
      strategyInitializer: mikro(),
      namingConventions: new CamelCaseNamingConvention()
    }),
    ProviderModule,
    MikroOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const config = await defineConfig();
        return {
          ...config,
          host: config.host ?? configService.get<string>("POSTGRES_HOST"),
          port: config.port ?? configService.get<number>("POSTGRES_PORT"),
          user: config.user ?? configService.get<string>("POSTGRES_USER"),
          password: config.password ?? configService.get<string>("POSTGRES_PASSWORD")
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
    }),
    ScheduleModule.forRoot(),
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        // Resolve the first existing template directory to avoid environment/path drift.
        const templateDirCandidates = [
          path.join(
            process.cwd(),
            'src',
            'infrastructure',
            'domain',
            'common',
            'templates',
            'emails'
          ),
          path.join(
            process.cwd(),
            'dist',
            'src',
            'infrastructure',
            'domain',
            'common',
            'templates',
            'emails'
          ),
          path.join(
            __dirname,
            'infrastructure',
            'domain',
            'common',
            'templates',
            'emails'
          ),
          path.join(
            __dirname,
            '..',
            'infrastructure',
            'domain',
            'common',
            'templates',
            'emails'
          )
        ];

        const templateDir =
          templateDirCandidates.find((dirPath) => fs.existsSync(dirPath)) ??
          templateDirCandidates[0];

        return {
          transport: {
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: {
              user: config.get<string>('GOOGLE_EMAIL'),
              pass: config.get<string>('GOOGLE_APP_PASSWORD')
            }
          },
          defaults: {
            from: 'No reply <noreply@perfume.com>'
          },
          template: {
            dir: templateDir,
            adapter: new EjsAdapter(),
            options: {}
          },
          preview: true
        };
      }
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST'),
          port: config.get<number>('REDIS_PORT')
        }
      })
    }),
    I18nModule.forRoot({
      fallbackLanguage: 'vi',
      loaderOptions: {
        path: (() => {
          const p = [
            path.join(process.cwd(), 'src', 'i18n'),
            path.join(process.cwd(), 'dist', 'i18n'),
            path.join(__dirname, 'i18n'),
            path.join(__dirname, '..', 'i18n'),
          ].find((dir) => fs.existsSync(dir));
          return p || path.join(__dirname, 'i18n');
        })(),
        watch: true,
      },
      resolvers: [
        { use: QueryResolver, options: ['lang'] },
        HeaderResolver,
      ],
    }),
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
export class AppModule { }
