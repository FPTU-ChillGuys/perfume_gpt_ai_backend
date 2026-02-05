import { PagedAndSortedRequest } from "./paged-and-sorted.request"

export class InventoryStockRequest extends PagedAndSortedRequest{
    VariantId?: string;
    SearchTerm?: string;
    IsLowStock?: boolean;
}