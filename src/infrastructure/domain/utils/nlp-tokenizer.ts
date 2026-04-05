import * as natural from 'natural';

const tokenizer = new natural.WordTokenizer();

const PHRASE_DICT = new Set([
  // vi — domain nước hoa
  'nước hoa', 'hoa hồng', 'hoa nhài', 'hoa oải hương',
  'cam quýt', 'gỗ đàn hương', 'xạ hương', 'mùi hương',
  'lâu trôi', 'lưu hương', 'gợi ý', 'tặng quà',
  // en — perfume domain
  'long lasting', 'eau de parfum', 'eau de toilette',
  'floral scent', 'woody scent', 'fresh scent',
  'rose perfume', 'citrus perfume', 'vanilla perfume',
]);

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'for', 'from',
  'in', 'is', 'it', 'or', 'of', 'on', 'the', 'to', 'with',
  'cho', 'cua', 'de', 'la', 'nhu', 'o', 'tai', 'toi', 'va', 'voi',
]);

/**
 * Tokenize text thành list keyword, hỗ trợ tiếng Việt và tiếng Anh.
 * - Dùng natural.WordTokenizer để tách token
 * - Bigram/trigram detection qua PHRASE_DICT (vd: "nước hoa", "gỗ đàn hương")
 * - Loại stopwords và unigram đã ghép thành phrase
 */
export function tokenizeText(input: string): string[] {
  if (!input) return [];

  const normalized = input.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ');
  const unigrams = (tokenizer.tokenize(normalized) ?? [])
    .filter(t => t.length >= 2 && !STOP_WORDS.has(t));

  // trigram trước — ưu tiên phrase dài hơn (vd: "gỗ đàn hương", "eau de parfum")
  const matchedTrigrams = natural.NGrams.trigrams(unigrams)
    .map(trio => trio.join(' '))
    .filter(tg => PHRASE_DICT.has(tg));

  // bigram sau
  const matchedBigrams = natural.NGrams.bigrams(unigrams)
    .map(pair => pair.join(' '))
    .filter(bg => PHRASE_DICT.has(bg));

  const matchedPhrases = [...matchedTrigrams, ...matchedBigrams];

  // loại unigram đã được ghép thành phrase
  const usedTokens = new Set<string>();
  for (const phrase of matchedPhrases) {
    for (const part of phrase.split(' ')) usedTokens.add(part);
  }
  const remainingUnigrams = unigrams.filter(t => !usedTokens.has(t));

  return [...matchedPhrases, ...remainingUnigrams];
}
