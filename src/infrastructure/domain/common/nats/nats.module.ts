import { Module, Global } from '@nestjs/common';
import { NatsRpcService } from './nats-rpc.service';

@Global()
@Module({
  providers: [NatsRpcService],
  exports: [NatsRpcService],
})
export class NatsModule {}
