export default function ApiUrl() {
  const BASE_URL = process.env.BASE_URL || '';

  const PRODUCT_URL = (url: string) => `${BASE_URL}/products/${url}`;

  const REVIEW_URL = (url: string) => `${BASE_URL}/reviews/${url}`;

  const ORDER_URL = (url: string) => `${BASE_URL}/orders/${url}`;

  return {
    PRODUCT_URL,
    REVIEW_URL,
    ORDER_URL
  };
}
