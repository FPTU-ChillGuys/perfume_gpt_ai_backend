export default function ApiUrl() {
  const BASE_URL = process.env.BASE_URL || '';

  const PRODUCT_URL = (url: string) => `${BASE_URL}/products/${url}`;

  return {
    PRODUCT_URL
  };
}
