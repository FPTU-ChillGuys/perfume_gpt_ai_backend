export const BASE_URL = process.env.BASE_URL || '';

export const PRODUCT_URL = (url: string) => `${BASE_URL}/products/${url}`;
