export class ProductResponse {
  id!: string;
  name!: string;
  brandId!: number;
  brandName!: string;
  categoryId!: number;
  categoryName!: string;
  familyId!: number | null;
  familyName!: string | null;
  description!: string;
  topNotes!: string;
  middleNotes!: string;
  baseNotes!: string;
}

export class ProductListResponse {
  items!: ProductResponse[];
}
