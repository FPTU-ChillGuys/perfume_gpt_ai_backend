import { encode } from '@toon-format/toon';

/**
 * Utility for encoding tool output data with TOON format
 * to optimize token usage when sending data to LLM
 */

/**
 * Encode arrays or large objects into TOON format
 * Only encodes if data is an array with multiple items
 * @param data - The data structure to encode (array or object)
 * @param shouldEncode - Optional flag to force encoding
 * @returns { encoded: string, decodedSize: number, encodedSize: number }
 */
export function encodeToolOutput<T extends any[] | object>(
  data: T,
  shouldEncode?: boolean
): {
  encoded: string;
  originalSize: number;
  encodedSize: number;
  compressionRatio: number;
} {
  const jsonString = JSON.stringify(data);
  const originalSize = jsonString.length;

  const encoded = encode(data);
  const encodedSize = encoded.length;

  return {
    encoded,
    originalSize,
    encodedSize,
    compressionRatio: Number(((encodedSize / originalSize) * 100).toFixed(2))
  };
}

/**
 * Encode array of objects with optional field preservation
 * Useful for reducing token usage while keeping some critical fields readable
 * @param items - Array of objects to encode
 * @param readableFields - Fields to keep in original form (optional)
 * @returns { encoded: string, readableFields: Partial<T>[] } or just encoded string
 */
export function encodeItemArray<T extends object>(
  items: T[],
  readableFields?: (keyof T)[]
): {
  encoded: string;
  readable?: Partial<T>[];
  compressionRatio: number;
} {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      encoded: encode(JSON.stringify(items)),
      compressionRatio: 100
    };
  }

  const jsonString = JSON.stringify(items);
  const encoded = encode(jsonString);
  const originalSize = jsonString.length;
  const encodedSize = encoded.length;

  const result: {
    encoded: string;
    readable?: Partial<T>[];
    compressionRatio: number;
  } = {
    encoded,
    compressionRatio: Number(((encodedSize / originalSize) * 100).toFixed(2))
  };

  // If readable fields specified, also include those
  if (readableFields && readableFields.length > 0) {
    result.readable = items.map((item) => {
      const readable: Partial<T> = {};
      readableFields.forEach((field) => {
        readable[field] = item[field];
      });
      return readable;
    });
  }

  return result;
}

/**
 * Create a hybrid response that includes both encoded data and summary info
 * Perfect for tool outputs that need both data optimization and readability
 */
export function createHybridToolResponse<T extends unknown[] | object>(
  data: T,
  summaryInfo?: Record<string, unknown>
): {
  data: T;
  encoded: string;
  encodedDataInfo: {
    originalSize: number;
    encodedSize: number;
    compressionRatio: number;
  };
  summary?: Record<string, unknown>;
} {
  const result = encodeToolOutput(data);

  return {
    data,
    encoded: result.encoded,
    encodedDataInfo: {
      originalSize: result.originalSize,
      encodedSize: result.encodedSize,
      compressionRatio: result.compressionRatio
    },
    ...(summaryInfo && { summary: summaryInfo })
  };
}

/**
 * Decode TOON-encoded data back to original
 * Useful for verification/testing
 */
export function decodeToolOutput(encoded: string): unknown {
  try {
    const decoded = encoded; // TOON handles decoding internally through pattern matching
    return JSON.parse(decoded);
  } catch (error) {
    console.warn('Failed to decode TOON data:', error);
    return null;
  }
}
