export const AI_ACCEPTANCE_CONTEXTS = [
  'cart_legacy',
  'chatbot',
  'survey',
  'trend',
  'recommendation',
  'repurchase'
] as const;

export type AIAcceptanceContextType = (typeof AI_ACCEPTANCE_CONTEXTS)[number];

export const AI_ACCEPTANCE_DEFAULT_VISIBLE_HOURS = 24;
