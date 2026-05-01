import { Injectable, Logger } from '@nestjs/common';
import {
  QueryFragment,
  QueryAnswerPayload,
  QueryValidationResult,
  SURVEY_ATTRIBUTE_TYPES,
  SurveyAttributeType
} from './survey-query.types';

/**
 * Validate format của query fragment.
 * Chỉ kiểm tra cấu trúc JSON, không chạy thử query vào DB.
 */
@Injectable()
export class SurveyQueryValidatorService {
  private readonly logger = new Logger(SurveyQueryValidatorService.name);

  /** Validate 1 query fragment */
  validateQueryFragment(fragment: any): QueryValidationResult {
    const errors: string[] = [];

    if (!fragment || typeof fragment !== 'object') {
      return { valid: false, errors: ['queryFragment phải là 1 object'] };
    }

    // Check type
    if (!fragment.type) {
      errors.push('Thiếu field "type"');
    } else if (!SURVEY_ATTRIBUTE_TYPES.includes(fragment.type)) {
      errors.push(
        `Type "${fragment.type}" không hợp lệ. Các type cho phép: ${SURVEY_ATTRIBUTE_TYPES.join(', ')}`
      );
    }

    // Validate by type
    switch (fragment.type as SurveyAttributeType) {
      case 'gender':
      case 'origin':
      case 'brand':
      case 'category':
      case 'concentration':
      case 'note':
      case 'family':
        if (!fragment.match || typeof fragment.match !== 'string') {
          errors.push(`Type "${fragment.type}" yêu cầu field "match" (string)`);
        }
        break;

      case 'attribute':
        if (!fragment.match || typeof fragment.match !== 'string') {
          errors.push('Type "attribute" yêu cầu field "match" (string)');
        }
        if (
          !fragment.attributeName ||
          typeof fragment.attributeName !== 'string'
        ) {
          errors.push(
            'Type "attribute" yêu cầu field "attributeName" (string)'
          );
        }
        break;

      case 'budget':
        if (fragment.min !== undefined && typeof fragment.min !== 'number') {
          errors.push('Budget "min" phải là number');
        }
        if (fragment.max !== undefined && typeof fragment.max !== 'number') {
          errors.push('Budget "max" phải là number');
        }
        if (fragment.min === undefined && fragment.max === undefined) {
          errors.push('Budget cần ít nhất 1 trong 2 field "min" hoặc "max"');
        }
        if (
          fragment.min !== undefined &&
          fragment.max !== undefined &&
          fragment.min > fragment.max
        ) {
          errors.push('Budget "min" không được lớn hơn "max"');
        }
        break;
    }

    return { valid: errors.length === 0, errors };
  }

  /** Validate 1 answer payload (displayText + queryFragment) */
  validateAnswerPayload(payload: any): QueryValidationResult {
    const errors: string[] = [];

    if (!payload || typeof payload !== 'object') {
      return { valid: false, errors: ['Answer payload phải là 1 object'] };
    }

    if (!payload.displayText || typeof payload.displayText !== 'string') {
      errors.push('Thiếu field "displayText" (string)');
    }

    if (!payload.queryFragment) {
      errors.push('Thiếu field "queryFragment"');
    } else {
      const fragmentResult = this.validateQueryFragment(payload.queryFragment);
      errors.push(...fragmentResult.errors);
    }

    return { valid: errors.length === 0, errors };
  }

  /** Attempt to parse answer text as QueryAnswerPayload */
  tryParseAnswerAsQuery(answerText: string): QueryAnswerPayload | null {
    try {
      const parsed = JSON.parse(answerText);
      if (parsed && parsed.queryFragment && parsed.displayText) {
        const validation = this.validateAnswerPayload(parsed);
        if (validation.valid) {
          return parsed as QueryAnswerPayload;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  /** Check if an answer text contains a query payload */
  isQueryBasedAnswer(answerText: string): boolean {
    return this.tryParseAnswerAsQuery(answerText) !== null;
  }
}
