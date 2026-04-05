export default function ApiUrl() {
  const BASE_URL = process.env.BASE_URL || '';

  const PRODUCT_URL = (url: string) => `${BASE_URL}/products/${url}`;

  const REVIEW_URL = (url: string) => `${BASE_URL}/reviews/${url}`;

  const ORDER_URL = (url: string) => `${BASE_URL}/orders/${url}`;

  const CART_URL = (url: string) => `${BASE_URL}/cart/${url}`;

  const INVENTORY_URL = (url: string) => `${BASE_URL}/inventory/${url}`;

  const PROFILE_URL = (url: string) => `${BASE_URL}/profiles/${url}`;

  const USER_URL = (url: string) => `${BASE_URL}/users/${url}`; 
  return {
    PRODUCT_URL,
    REVIEW_URL,
    ORDER_URL,
    INVENTORY_URL,
    PROFILE_URL,
    USER_URL,
    CART_URL
  };
}
