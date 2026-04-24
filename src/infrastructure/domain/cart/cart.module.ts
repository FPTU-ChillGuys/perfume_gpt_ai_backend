import { Module } from '@nestjs/common';
import { CartService } from './cart.service';
import { CartTool } from 'src/chatbot/tools/cart.tool';
import { CartNatsRepository } from '../repositories/nats/cart-nats.repository';
import { NatsModule } from '../common/nats/nats.module';

@Module({
    imports: [NatsModule],
    providers: [CartService, CartTool, CartNatsRepository],
    exports: [CartService, CartTool, CartNatsRepository],
})
export class CartModule { }
