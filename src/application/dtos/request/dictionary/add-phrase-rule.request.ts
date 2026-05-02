import {
  IsString,
  IsNumber,
  IsOptional,
  Min,
  Max,
  IsIn
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const VALID_RULE_TYPES = ['consume', 'extract', 'replace'] as const;
const VALID_SCOPES = ['global', 'product', 'brand'] as const;

export class AddPhraseRuleRequest {
  @ApiProperty({
    description: 'Phrase text (can include diacritics)',
    example: 'có hương'
  })
  @IsString()
  phrase: string;

  @ApiProperty({
    description: 'Rule type',
    example: 'consume',
    enum: VALID_RULE_TYPES
  })
  @IsString()
  @IsIn(VALID_RULE_TYPES)
  ruleType: string;

  @ApiPropertyOptional({
    description: 'Rule scope',
    example: 'global',
    default: 'global',
    enum: VALID_SCOPES
  })
  @IsOptional()
  @IsString()
  @IsIn(VALID_SCOPES)
  scope?: string;

  @ApiPropertyOptional({
    description: 'Confidence score (0-1)',
    example: 1.0,
    default: 1
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;
}
