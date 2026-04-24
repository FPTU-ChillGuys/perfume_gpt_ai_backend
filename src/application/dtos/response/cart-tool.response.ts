/** Minimal product info cho tool output */
export interface MinimalProduct {
  id: string;
  name: string;
  brandName: string;
  categoryName: string;
}

/** Kết quả cart item */
export interface CartItemResult {
  variantId: string;
  success: boolean;
  error?: string;
}

/** Kết quả thêm cart */
export interface AddToCartResult {
  success: boolean;
  data: CartItemResult[];
}
