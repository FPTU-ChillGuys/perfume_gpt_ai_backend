import { Module } from '@nestjs/common';
import { AppController } from './api/controllers/app.controller';
import { AppService } from './app.service';
import { AutomapperModule } from '@automapper/nestjs';
import { classes } from '@automapper/classes';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import defineConfig from '../mikro-orm.config';

@Module({
  imports: [
    AutomapperModule.forRoot({
      ...defineConfig,
      strategyInitializer: classes()
    }),
    MikroOrmModule.forRoot({
      autoLoadEntities: true
    })
  ],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}
