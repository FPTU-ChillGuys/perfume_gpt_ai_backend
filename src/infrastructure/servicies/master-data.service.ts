import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { JaroWinklerDistance } from 'natural';

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

    async fuzzySearch(keyword: string, type: 'brand' | 'category' | 'note' | 'family' | 'attribute') {
        let items: { id: string | number, name: string }[] = [];

        switch (type) {
            case 'brand':
                items = (await this.prisma.brands.findMany({ select: { Id: true, Name: true } })).map(x => ({ id: x.Id, name: x.Name }));
                break;
            case 'category':
                items = (await this.prisma.categories.findMany({ select: { Id: true, Name: true } })).map(x => ({ id: x.Id, name: x.Name }));
                break;
            case 'note':
                items = (await this.prisma.scentNotes.findMany({ select: { Id: true, Name: true } })).map(x => ({ id: x.Id, name: x.Name }));
                break;
            case 'family':
                items = (await this.prisma.olfactoryFamilies.findMany({ select: { Id: true, Name: true } })).map(x => ({ id: x.Id, name: x.Name }));
                break;
            case 'attribute':
                const attrValues = await this.prisma.attributeValues.findMany({ select: { Id: true, Value: true } });
                items = attrValues.map(x => ({ id: x.Id, name: x.Value }));
                break;
        }

        const scored = items.map(item => ({
            ...item,
            score: JaroWinklerDistance(keyword.toLowerCase(), item.name.toLowerCase(), { ignoreCase: true })
        }));

        return scored
            .filter(x => x.score > 0.5) // Lower threshold for misspelled words
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);
    }
}
