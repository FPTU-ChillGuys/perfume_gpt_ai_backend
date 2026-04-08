import { ApiProperty } from '@nestjs/swagger';

export class ProfileResponse {
    @ApiProperty({ description: 'User date of birth', nullable: true })
    dateOfBirth!: string | null;

    @ApiProperty({ description: 'Profile creation date' })
    createdAt!: string;

    @ApiProperty({ description: 'Favorite perfume notes', nullable: true })
    favoriteNotes!: string | null;

    @ApiProperty({ description: 'Profile ID' })
    id!: string;

    @ApiProperty({ description: 'Maximum budget', nullable: true })
    maxBudget!: number | string | null;

    @ApiProperty({ description: 'Minimum budget', nullable: true })
    minBudget!: number | string | null;

    @ApiProperty({ description: 'Preferred perfume style', nullable: true })
    preferredStyle!: string | null;

    @ApiProperty({ description: 'Scent preference', nullable: true })
    scentPreference!: string | null;

    @ApiProperty({ description: 'Last update date', nullable: true })
    updatedAt!: string | null;

    @ApiProperty({ description: 'Associated user ID' })
    userId!: string;

    constructor(partial: Partial<ProfileResponse>) {
        Object.assign(this, partial);
    }
}
