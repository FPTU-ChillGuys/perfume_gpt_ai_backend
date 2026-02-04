export class ReviewListItemResponse {
    commentPreview: string;
    createdAt: string; // ISO 8601 date-time format
    id: string; // UUID
    imageCount: number;
    rating: number;
    status: 'Pending' | 'Approved' | 'Rejected';
    userFullName: string;
    userId: string; // UUID
    userProfilePictureUrl: string | null;
    variantId: string; // UUID
    variantName: string;
}

export class ReviewResponse {
	id: string; // UUID
	userId: string; // UUID
	userFullName: string;
	userProfilePictureUrl: string | null;
	orderDetailId: string; // UUID
	variantId: string; // UUID
	variantName: string;
	rating: number;
	comment: string;
	status: 'Pending' | 'Approved' | 'Rejected';
	images: MediaResponse[];
	createdAt: string; // ISO 8601 date-time format
	updatedAt: string | null; // ISO 8601 date-time format
}

export class MediaResponse {
	id: string; // UUID
	url: string;
	altText: string | null;
	displayOrder: number;
	isPrimary: boolean;
	fileSize: number | null;
	mimeType: string | null;
}

export class ReviewStatisticsResponse {
	variantId: string; // UUID
	totalReviews: number;
	averageRating: number;
	fiveStarCount: number;
	fourStarCount: number;
	threeStarCount: number;
	twoStarCount: number;
	oneStarCount: number;
}