/**
 * Utility to sanitize payloads before sending via NATS.
 * Removes null, undefined, and empty string values from objects
 * to prevent .NET deserialization errors.
 */

/**
 * Recursively removes null, undefined, and empty string values from an object.
 * Also removes empty arrays and empty objects.
 *
 * @param obj - The object to sanitize
 * @returns A new object with null/undefined/empty values removed
 */
export function sanitizeNatsPayload<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    const sanitizedArray = obj
      .map((item) => sanitizeNatsPayload(item))
      .filter((item) => item !== null && item !== undefined);

    return sanitizedArray as unknown as T;
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      continue;
    }

    if (typeof value === 'string' && value.trim() === '') {
      continue;
    }

    if (typeof value === 'object') {
      const sanitizedValue = sanitizeNatsPayload(value);

      // Skip empty arrays
      if (Array.isArray(sanitizedValue) && sanitizedValue.length === 0) {
        continue;
      }

      // Skip empty objects
      if (
        typeof sanitizedValue === 'object' &&
        sanitizedValue !== null &&
        !Array.isArray(sanitizedValue) &&
        Object.keys(sanitizedValue).length === 0
      ) {
        continue;
      }

      result[key] = sanitizedValue;
    } else {
      result[key] = value;
    }
  }

  return result as T;
}
