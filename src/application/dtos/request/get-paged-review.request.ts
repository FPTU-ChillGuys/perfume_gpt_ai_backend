import { PagedAndSortedRequest } from "./paged-and-sorted.request";

export class GetPagedReviewRequest extends PagedAndSortedRequest{
	VariantId?: string;
	UserId?: string;
	Status?: string;
	MinRating?: number;
	MaxRating?: number;
	HasImages?: boolean;
}