import { Module } from '@nestjs/common';
import { CartService } from './cart.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CartTool } from 'src/chatbot/tools/cart.tool';

@Module({
    imports: [PrismaModule],
    providers: [CartService, CartTool],
    exports: [CartService, CartTool],
})
export class CartModule { }
