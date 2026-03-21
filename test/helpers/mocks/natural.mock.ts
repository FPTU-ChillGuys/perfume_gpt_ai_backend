export class WordTokenizer {
  tokenize(input: string): string[] {
    if (!input) {
      return [];
    }

    return input
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 0);
  }
}

export const NGrams = {
  bigrams(tokens: string[]): string[][] {
    const result: string[][] = [];
    for (let i = 0; i < tokens.length - 1; i += 1) {
      result.push([tokens[i], tokens[i + 1]]);
    }
    return result;
  },
  trigrams(tokens: string[]): string[][] {
    const result: string[][] = [];
    for (let i = 0; i < tokens.length - 2; i += 1) {
      result.push([tokens[i], tokens[i + 1], tokens[i + 2]]);
    }
    return result;
  }
};
