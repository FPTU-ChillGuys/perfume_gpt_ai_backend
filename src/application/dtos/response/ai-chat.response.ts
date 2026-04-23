import { ProductCardOutputItem } from 'src/chatbot/output/product.output';

export interface AiChatResponse {
  message: string;
  products: ProductCardOutputItem[] | null;
  productTemp: AiProductTempItem[] | null;
  suggestedQuestions: string[];
}

export interface AiProductTempItem {
  id: string;
  name: string | null;
  variants: Array<{ id: string; price: number }> | null;
  reasoning: string;
  source: string;
}

export interface MinimalProduct {
  id: string;
  name: string;
  brand: string;
  category: string;
  image: string | null;
  attributes: string[];
  scentNotes: any; // Keep any if scentNotes is complex/dynamic, or define interface
  olfactoryFamilies: any;
  variants: MinimalProductVariant[];
  source: string;
}

export interface MinimalProductVariant {
  id: string;
  volume: number;
  price: number;
}

export interface ToolActionResult {
  products: MinimalProduct[];
  actionResult: any | null; // This can be different shapes based on tool
}

export interface MultiQueryExecutionResult {
  mergedProducts: MinimalProduct[];
  taskResults: any[];
}
