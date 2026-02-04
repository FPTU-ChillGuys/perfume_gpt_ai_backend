export class ReviewResponse {
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

export class ReviewListItemResponse {
    items: ReviewResponse[];
}