import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class MasterDataService {
    constructor(private readonly prisma: PrismaService) { }

    async searchBrands(keyword: string) {
        return this.prisma.brands.findMany({
            where: { Name: { contains: keyword } },
            take: 10,
        });
    }

    async searchCategories(keyword: string) {
        return this.prisma.categories.findMany({
            where: { Name: { contains: keyword } },
            take: 10,
        });
    }

    async searchScentNotes(keyword: string) {
        return this.prisma.scentNotes.findMany({
            where: { Name: { contains: keyword } },
            take: 20,
        });
    }

    async searchOlfactoryFamilies(keyword: string) {
        return this.prisma.olfactoryFamilies.findMany({
            where: { Name: { contains: keyword } },
            take: 10,
        });
    }

    async getAttributesWithValues() {
        return this.prisma.attributes.findMany({
            include: {
                AttributeValues: true,
            },
        });
    }

    /**
     * Search for a specific attribute value across all attributes
     */
    async searchAttributeValues(keyword: string) {
        return this.prisma.attributeValues.findMany({
            where: { Value: { contains: keyword } },
            include: {
                Attributes: true,
            },
            take: 20,
        });
    }

    async searchProducts(keyword: string) {
        return this.prisma.products.findMany({
            where: { Name: { contains: keyword } },
            select: {
                Id: true,
                Name: true,
            },
            take: 10,
        });
    }
}
