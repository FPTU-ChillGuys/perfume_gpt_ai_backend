import { Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';

/**
 * Service để load prompt templates từ i18n JSON files.
 * Sử dụng nestjs-i18n built-in interpolation ({variable}) qua args.
 *
 * Usage:
 *   const prompt = this.promptLoader.get('system.optimization_full');
 *   const prompt = this.promptLoader.get('system.internal_norm_full', {
 *     CONTEXT: jsonData,
 *     KEYWORDS: 'dior, hoa nhài'
 *   });
 */
@Injectable()
export class PromptLoaderService {
  constructor(private readonly i18n: I18nService) {}

  /**
   * Load a prompt template from i18n with built-in interpolation.
   * @param key - i18n key relative to `prompts.` namespace (e.g., 'system.optimization_full')
   * @param args - Optional key-value pairs passed to nestjs-i18n's built-in interpolation
   * @returns The resolved prompt string
   */
  get(key: string, args?: Record<string, string>): string {
    const text = this.i18n.t(`prompts.${key}`, { lang: 'vi', args });

    if (typeof text !== 'string') {
      return JSON.stringify(text);
    }

    return text;
  }
}
