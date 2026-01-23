import { Module } from '@nestjs/common';
import { AppController } from './controllers/app.controller';
import { AppService } from './app.service';
import { AutomapperModule } from '@automapper/nestjs';
import { classes } from '@automapper/classes';
import { MikroOrmModule } from '@mikro-orm/nestjs';

@Module({
  imports: [
    AutomapperModule.forRoot({
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
