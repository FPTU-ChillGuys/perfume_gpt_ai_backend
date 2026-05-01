import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { JaroWinklerDistance } from 'natural';

@Injectable()
export class MasterDataService {
  constructor(private readonly prisma: PrismaService) {}

  async getNormalizationContextData() {
    const [notes, families, attributes, products, variants] = await Promise.all(
      [
        this.prisma.scentNotes.findMany({
          select: { Name: true },
          orderBy: { Name: 'asc' },
          take: 300
        }),
        this.prisma.olfactoryFamilies.findMany({
          select: { Name: true },
          orderBy: { Name: 'asc' },
          take: 200
        }),
        this.prisma.attributes.findMany({
          include: {
            AttributeValues: true
          }
        }),
        this.prisma.products.findMany({
          where: { IsDeleted: false },
          select: {
            Id: true,
            Name: true,
            Origin: true,
            Gender: true,
            ReleaseYear: true,
            Brands: { select: { Name: true } },
            Categories: { select: { Name: true } }
          },
          orderBy: { UpdatedAt: 'desc' },
          take: 300
        }),
        this.prisma.productVariants.findMany({
          where: { IsDeleted: false },
          select: {
            Type: true,
            Longevity: true,
            Sillage: true,
            Concentrations: { select: { Name: true } }
          },
          take: 600
        })
      ]
    );

    const origins = Array.from(
      new Set(
        products
          .map((item) => item.Origin?.trim())
          .filter((item): item is string => Boolean(item))
      )
    );

    const genders = Array.from(
      new Set(
        products
          .map((item) => item.Gender?.trim())
          .filter((item): item is string => Boolean(item))
      )
    );

    const releaseYears = Array.from(
      new Set(
        products
          .map((item) => Number(item.ReleaseYear))
          .filter((item) => Number.isFinite(item) && item > 0)
      )
    ).sort((a, b) => b - a);

    const concentrationNames = Array.from(
      new Set(
        variants
          .map((item) => item.Concentrations?.Name?.trim())
          .filter((item): item is string => Boolean(item))
      )
    );

    const variantTypes = Array.from(
      new Set(
        variants
          .map((item) => item.Type?.trim())
          .filter((item): item is string => Boolean(item))
      )
    );

    const longevityLevels = Array.from(
      new Set(
        variants
          .map((item) => Number(item.Longevity))
          .filter((item) => Number.isFinite(item) && item > 0)
      )
    ).sort((a, b) => a - b);

    const sillageLevels = Array.from(
      new Set(
        variants
          .map((item) => Number(item.Sillage))
          .filter((item) => Number.isFinite(item) && item > 0)
      )
    ).sort((a, b) => a - b);

    return {
      notes: notes.map((item) => item.Name),
      families: families.map((item) => item.Name),
      attributes: attributes.map((attribute) => ({
        name: attribute.Name,
        values: attribute.AttributeValues.map((value) => value.Value)
      })),
      genders,
      origins,
      releaseYears,
      concentrationNames,
      variantTypes,
      longevityLevels,
      sillageLevels,
      sampleProducts: products.slice(0, 80).map((item) => ({
        id: item.Id,
        name: item.Name,
        brand: item.Brands?.Name,
        category: item.Categories?.Name,
        origin: item.Origin,
        gender: item.Gender,
        releaseYear: item.ReleaseYear
      }))
    };
  }

  async searchBrands(keyword: string) {
    return this.prisma.brands.findMany({
      where: { Name: { contains: keyword } },
      take: 10
    });
  }

  async searchCategories(keyword: string) {
    return this.prisma.categories.findMany({
      where: { Name: { contains: keyword } },
      take: 10
    });
  }

  async searchScentNotes(keyword: string) {
    return this.prisma.scentNotes.findMany({
      where: { Name: { contains: keyword } },
      take: 20
    });
  }

  async searchOlfactoryFamilies(keyword: string) {
    return this.prisma.olfactoryFamilies.findMany({
      where: { Name: { contains: keyword } },
      take: 10
    });
  }

  async getAttributesWithValues() {
    return this.prisma.attributes.findMany({
      include: {
        AttributeValues: true
      }
    });
  }

  /**
   * Search for a specific attribute value across all attributes
   */
  async searchAttributeValues(keyword: string) {
    return this.prisma.attributeValues.findMany({
      where: { Value: { contains: keyword } },
      include: {
        Attributes: true
      },
      take: 20
    });
  }

  async searchProducts(keyword: string) {
    return this.prisma.products.findMany({
      where: { Name: { contains: keyword } },
      select: {
        Id: true,
        Name: true
      },
      take: 10
    });
  }

  /**
   * Count products matching a keyword in a specific type field.
   * Used to validate that a keyword actually matches real products in DB.
   */
  async countProductsByField(keyword: string, type: string): Promise<number> {
    const where = this.buildTypeWhereClause(keyword, type);
    if (!where) return 0;
    return this.prisma.products.count({
      where: { IsDeleted: false, ...where }
    });
  }

  /**
   * Build Prisma WHERE clause for a keyword by type.
   * Maps type to the corresponding product field for count/validation queries.
   */
  private buildTypeWhereClause(keyword: string, type: string): any {
    switch (type) {
      case 'brand':
        return { Brands: { Name: { contains: keyword } } };
      case 'category':
        return { Categories: { Name: { contains: keyword } } };
      case 'note':
        return {
          ProductNoteMaps: {
            some: { ScentNotes: { Name: { contains: keyword } } }
          }
        };
      case 'family':
        return {
          ProductFamilyMaps: {
            some: { OlfactoryFamilies: { Name: { contains: keyword } } }
          }
        };
      case 'attribute':
        return {
          ProductAttributes: {
            some: { AttributeValues: { Value: { contains: keyword } } }
          }
        };
      case 'product':
        return { Name: { contains: keyword } };
      case 'gender':
        return { Gender: { equals: keyword } };
      default:
        return null;
    }
  }

  async fuzzySearch(
    keyword: string,
    type: 'brand' | 'category' | 'note' | 'family' | 'attribute'
  ) {
    let items: { id: string | number; name: string }[] = [];

    switch (type) {
      case 'brand':
        items = (
          await this.prisma.brands.findMany({
            select: { Id: true, Name: true }
          })
        ).map((x) => ({ id: x.Id, name: x.Name }));
        break;
      case 'category':
        items = (
          await this.prisma.categories.findMany({
            select: { Id: true, Name: true }
          })
        ).map((x) => ({ id: x.Id, name: x.Name }));
        break;
      case 'note':
        items = (
          await this.prisma.scentNotes.findMany({
            select: { Id: true, Name: true }
          })
        ).map((x) => ({ id: x.Id, name: x.Name }));
        break;
      case 'family':
        items = (
          await this.prisma.olfactoryFamilies.findMany({
            select: { Id: true, Name: true }
          })
        ).map((x) => ({ id: x.Id, name: x.Name }));
        break;
      case 'attribute':
        const attrValues = await this.prisma.attributeValues.findMany({
          select: { Id: true, Value: true }
        });
        items = attrValues.map((x) => ({ id: x.Id, name: x.Value }));
        break;
    }

    const scored = items.map((item) => ({
      ...item,
      score: JaroWinklerDistance(
        keyword.toLowerCase(),
        item.name.toLowerCase(),
        { ignoreCase: true }
      ),
      keyword: keyword
    }));

    return scored.sort((a, b) => b.score - a.score).slice(0, 5);
  }
}
