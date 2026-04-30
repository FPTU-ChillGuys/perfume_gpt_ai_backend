import { GoogleTrendSignal } from 'src/application/dtos/trend/google-trend-signal.type';

export class TrendHelpersUtil {
  static safeParseJson<T = unknown>(value: unknown): T | null {
    if (typeof value !== 'string') {
      return (value as T) ?? null;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  static normalizeKeyword(keyword: string): string {
    return keyword.trim().replace(/\s+/g, ' ');
  }

  static uniqueKeywords(keywords: string[], maxCount: number): string[] {
    const result: string[] = [];
    const seen = new Set<string>();

    for (const keyword of keywords) {
      const normalized = TrendHelpersUtil.normalizeKeyword(keyword);
      if (!normalized) {
        continue;
      }

      const key = normalized.toLowerCase();
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      result.push(normalized);
      if (result.length >= maxCount) {
        break;
      }
    }

    return result;
  }

  static truncateForLog(value: string, maxLength = 240): string {
    if (value.length <= maxLength) {
      return value;
    }

    return `${value.slice(0, maxLength)}...(truncated:${value.length - maxLength})`;
  }

  static estimateTokenCountFromChars(charCount: number): number {
    return Math.ceil(charCount / 4);
  }

  static summarizeSignals(signals: GoogleTrendSignal[]): {
    relatedQueryCount: number;
    interestOverTimeCount: number;
    preview: string;
  } {
    const relatedQueryCount = signals.filter(
      (signal) => signal.source === 'related_query'
    ).length;
    const interestOverTimeCount = signals.filter(
      (signal) => signal.source === 'interest_over_time'
    ).length;

    const preview = TrendHelpersUtil.truncateForLog(
      signals
        .slice(0, 8)
        .map((signal) => `${signal.keyword}:${signal.score}`)
        .join(' | '),
      360
    );

    return {
      relatedQueryCount,
      interestOverTimeCount,
      preview
    };
  }

  static toValidDate(value: unknown, fallback: Date): Date {
    if (!value) {
      return fallback;
    }

    const parsed = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? fallback : parsed;
  }

  static readString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  static readNullableString(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    return TrendHelpersUtil.readString(value);
  }

  static wait(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  static async withTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    timeoutErrorMessage: string
  ): Promise<T> {
    let timeoutHandle: NodeJS.Timeout | null = null;

    return new Promise<T>((resolve, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(timeoutErrorMessage));
      }, timeoutMs);

      operation()
        .then((value) => {
          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
          }
          resolve(value);
        })
        .catch((error) => {
          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
          }
          reject(error);
        });
    });
  }

  static extractInterestScore(rawPayload: unknown): number {
    const payload =
      rawPayload && typeof rawPayload === 'object'
        ? (rawPayload as Record<string, unknown>)
        : null;
    const defaultData =
      payload?.default && typeof payload.default === 'object'
        ? (payload.default as Record<string, unknown>)
        : null;
    const timelineData = Array.isArray(defaultData?.timelineData)
      ? defaultData.timelineData
      : [];

    if (timelineData.length === 0) {
      return 0;
    }

    const total = timelineData.reduce((sum, item) => {
      const row =
        item && typeof item === 'object'
          ? (item as Record<string, unknown>)
          : null;
      const values = Array.isArray(row?.value) ? row.value : [];
      const firstValue = values.length > 0 ? Number(values[0]) : 0;
      return sum + (Number.isFinite(firstValue) ? firstValue : 0);
    }, 0);

    return Number((total / timelineData.length).toFixed(2));
  }

  static extractRelatedSignals(
    rawPayload: unknown,
    parentKeyword: string,
    stage: import('src/application/dtos/trend/trend-seed-keyword.type').TrendSeedStage
  ): GoogleTrendSignal[] {
    const payload =
      rawPayload && typeof rawPayload === 'object'
        ? (rawPayload as Record<string, unknown>)
        : null;
    const defaultData =
      payload?.default && typeof payload.default === 'object'
        ? (payload.default as Record<string, unknown>)
        : null;
    const rankedList = Array.isArray(defaultData?.rankedList)
      ? defaultData.rankedList
      : [];

    const signals: GoogleTrendSignal[] = [];

    for (const listItem of rankedList) {
      const rankedKeyword =
        listItem && typeof listItem === 'object'
          ? (listItem as Record<string, unknown>).rankedKeyword
          : null;

      if (!Array.isArray(rankedKeyword)) {
        continue;
      }

      for (const keywordEntry of rankedKeyword.slice(0, 5)) {
        const row =
          keywordEntry && typeof keywordEntry === 'object'
            ? (keywordEntry as Record<string, unknown>)
            : null;

        const query = typeof row?.query === 'string' ? row.query.trim() : '';
        if (!query) {
          continue;
        }

        const numericValue = Number(row?.value);
        const score = Number.isFinite(numericValue) ? numericValue : 0;

        signals.push({
          keyword: query,
          score,
          source: 'related_query',
          stage,
          parentKeyword
        });
      }
    }

    return signals;
  }

  static extractProductsFromUnknown(
    unknownProducts: unknown[]
  ): import('src/chatbot/output/product.output').ProductCardOutputItem[] {
    const products: import('src/chatbot/output/product.output').ProductCardOutputItem[] = [];

    for (const unknownItem of unknownProducts) {
      const item =
        unknownItem && typeof unknownItem === 'object'
          ? (unknownItem as Record<string, unknown>)
          : null;

      if (!item) {
        continue;
      }

      const id = TrendHelpersUtil.readString(item.id);
      const name = TrendHelpersUtil.readString(item.name);
      const brandName = TrendHelpersUtil.readString(item.brandName) ?? 'Unknown';
      const rawVariants = Array.isArray(item.variants) ? item.variants : [];

      const variants: import('src/chatbot/output/product.output').ProductCardVariantOutput[] = [];
      for (const rawVariant of rawVariants) {
        const variant =
          rawVariant && typeof rawVariant === 'object'
            ? (rawVariant as Record<string, unknown>)
            : null;

        if (!variant) {
          continue;
        }

        const variantId = TrendHelpersUtil.readString(variant.id);
        const sku = TrendHelpersUtil.readString(variant.sku);
        const volumeMl = Number(variant.volumeMl);
        const basePrice = Number(variant.basePrice);

        if (
          !variantId ||
          !sku ||
          !Number.isFinite(volumeMl) ||
          !Number.isFinite(basePrice)
        ) {
          continue;
        }

        variants.push({
          id: variantId,
          sku,
          volumeMl,
          basePrice
        });
      }

      if (!id || !name || variants.length === 0) {
        continue;
      }

      products.push({
        id,
        name,
        brandName,
        primaryImage: TrendHelpersUtil.readNullableString(item.primaryImage),
        reasoning: TrendHelpersUtil.readNullableString(item.reasoning),
        source: TrendHelpersUtil.readNullableString(item.source),
        variants
      });
    }

    return products;
  }
}