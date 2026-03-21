export const DEFAULT_DELIMITER = '|';
export const DELIMITERS = ['|'];

export const encode = (input: unknown): string => {
  return JSON.stringify(input);
};

export const decode = <T = unknown>(input: string): T => {
  return JSON.parse(input) as T;
};

export const encodeLines = (input: unknown): string[] => {
  return [JSON.stringify(input)];
};

export const decodeFromLines = <T = unknown>(input: string[]): T => {
  return JSON.parse(input.join('')) as T;
};

export const decodeStream = async function* () {
  yield '';
};

export const decodeStreamSync = function* () {
  yield '';
};
