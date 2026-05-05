import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';

export class RecommendationTestRequest {
  @ApiProperty() @IsString() userId: string;
}

export class RepurchaseTestRequest {
  @ApiProperty() @IsString() userId: string;
  @ApiProperty() @IsString() orderId: string;
}

export class RecommendationV3SimpleRequest {
  @ApiProperty() @IsString() userId: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(50) size?: number;
}
