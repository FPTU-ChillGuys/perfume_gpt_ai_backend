import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsUUID, Min } from 'class-validator';

export class AddToCartRequest {
    @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
    @IsUUID()
    @IsNotEmpty()
    variantId: string;

    @ApiProperty({ example: 1 })
    @IsInt()
    @Min(1)
    quantity: number;
}
