import {
  IsString,
  IsNumber,
  IsOptional,
  Min,
  Max,
  IsEnum
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PhraseRuleType {
  CONSUME = 'consume',
  EXTRACT = 'extract',
  REPLACE = 'replace'
}

export enum PhraseRuleScope {
  GLOBAL = 'global',
  PRODUCT = 'product',
  BRAND = 'brand'
}

export class AddPhraseRuleRequest {
  @ApiProperty({
    description: 'Phrase text (can include diacritics)',
    example: 'có hương'
  })
  @IsString()
  phrase!: string;

  @ApiProperty({
    description: 'Rule type',
    example: 'consume',
    enum: PhraseRuleType
  })
  @IsEnum(PhraseRuleType)
  ruleType!: PhraseRuleType;

  @ApiPropertyOptional({
    description: 'Rule scope',
    example: 'global',
    enum: PhraseRuleScope
  })
  @IsOptional()
  @IsEnum(PhraseRuleScope)
  scope?: PhraseRuleScope;

  @ApiPropertyOptional({
    description: 'Confidence score (0-1)',
    example: 1.0
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;
}
