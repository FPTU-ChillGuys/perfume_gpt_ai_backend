export class CatalogItemResponse {
  id: string;
  productVariantId: string;
  supplierId: number;
  supplierName: string;
  variantSku: string;
  variantName: string;
  primaryImageUrl?: string;
  negotiatedPrice: number;
  estimatedLeadTimeDays: number;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt?: Date;

  constructor(partial: Partial<CatalogItemResponse>) {
    Object.assign(this, partial);
    if (this.createdAt) this.createdAt = new Date(this.createdAt);
    if (this.updatedAt) this.updatedAt = new Date(this.updatedAt);
  }
}
