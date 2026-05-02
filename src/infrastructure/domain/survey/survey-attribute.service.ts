import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  SURVEY_ATTRIBUTE_TYPES,
  SurveyAttributeType,
  SurveyAttributeTypeInfo,
  SurveyAttributeValueItem,
  SurveyAttributeValuesResponse,
  QueryFragment
} from './survey-query.types';

/**
 * Service cung cấp danh sách thuộc tính và giá trị cho Survey v4.
 * Admin chọn thuộc tính → hệ thống liệt kê giá trị → mỗi giá trị = 1 answer + queryFragment.
 */
@Injectable()
export class SurveyAttributeService {
  private readonly logger = new Logger(SurveyAttributeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Lấy danh sách tất cả loại thuộc tính có thể dùng cho survey */
  getAvailableAttributeTypes(): SurveyAttributeTypeInfo[] {
    return [
      {
        type: 'gender',
        label: 'Giới tính',
        description: 'Phân loại theo giới tính (Nam, Nữ, Unisex)'
      },
      {
        type: 'brand',
        label: 'Thương hiệu',
        description: 'Thương hiệu nước hoa (Chanel, Dior, ...)'
      },
      { type: 'category', label: 'Danh mục', description: 'Danh mục sản phẩm' },
      {
        type: 'origin',
        label: 'Xuất xứ',
        description: 'Quốc gia xuất xứ (Pháp, Ý, ...)'
      },
      {
        type: 'concentration',
        label: 'Nồng độ',
        description: 'Nồng độ nước hoa (EDP, EDT, Parfum, ...)'
      },
      {
        type: 'note',
        label: 'Nốt hương',
        description: 'Các nốt hương nước hoa (Vanilla, Rose, ...)'
      },
      {
        type: 'family',
        label: 'Nhóm hương',
        description: 'Họ nhóm hương (Floral, Woody, ...)'
      },
      {
        type: 'attribute',
        label: 'Thuộc tính sản phẩm',
        description: 'Thuộc tính mở rộng (Occasion, Season, Age, ...)'
      },
      {
        type: 'budget',
        label: 'Ngân sách',
        description: 'Khoảng giá mong muốn (từ-đến)'
      }
    ];
  }

  /** Lấy tất cả giá trị của 1 loại thuộc tính, trả về kèm queryFragment */
  async getAttributeValues(
    type: SurveyAttributeType
  ): Promise<SurveyAttributeValuesResponse> {
    this.logger.log(`[SurveyAttribute] Getting values for type: ${type}`);

    switch (type) {
      case 'gender':
        return this.getGenderValues();
      case 'brand':
        return this.getBrandValues();
      case 'category':
        return this.getCategoryValues();
      case 'origin':
        return this.getOriginValues();
      case 'concentration':
        return this.getConcentrationValues();
      case 'note':
        return this.getNoteValues();
      case 'family':
        return this.getFamilyValues();
      case 'attribute':
        return this.getProductAttributeValues();
      case 'budget':
        return this.getBudgetPresets();
      default:
        throw new Error(`Unknown attribute type: ${type}`);
    }
  }

  // ── Gender ──────────────────────────────────────────────────────
  private async getGenderValues(): Promise<SurveyAttributeValuesResponse> {
    const products = await this.prisma.products.findMany({
      where: { IsDeleted: false },
      select: { Gender: true },
      distinct: ['Gender']
    });

    const genders = [
      ...new Set(
        products
          .map((p) => p.Gender?.trim())
          .filter((g): g is string => Boolean(g) && g !== "N'")
      )
    ];

    return {
      type: 'gender',
      label: 'Giới tính',
      values: genders.map((g) => ({
        displayText: g,
        queryFragment: { type: 'gender' as const, match: g }
      }))
    };
  }

  // ── Brand ───────────────────────────────────────────────────────
  private async getBrandValues(): Promise<SurveyAttributeValuesResponse> {
    const brands = await this.prisma.brands.findMany({
      select: { Name: true },
      orderBy: { Name: 'asc' }
    });

    return {
      type: 'brand',
      label: 'Thương hiệu',
      values: brands
        .filter((b) => b.Name && b.Name !== "N'")
        .map((b) => ({
          displayText: b.Name,
          queryFragment: { type: 'brand' as const, match: b.Name }
        }))
    };
  }

  // ── Category ────────────────────────────────────────────────────
  private async getCategoryValues(): Promise<SurveyAttributeValuesResponse> {
    const categories = await this.prisma.categories.findMany({
      select: { Name: true },
      orderBy: { Name: 'asc' }
    });

    return {
      type: 'category',
      label: 'Danh mục',
      values: categories
        .filter((c) => c.Name && c.Name !== "N'")
        .map((c) => ({
          displayText: c.Name,
          queryFragment: { type: 'category' as const, match: c.Name }
        }))
    };
  }

  // ── Origin ──────────────────────────────────────────────────────
  private async getOriginValues(): Promise<SurveyAttributeValuesResponse> {
    const products = await this.prisma.products.findMany({
      where: { IsDeleted: false },
      select: { Origin: true },
      distinct: ['Origin']
    });

    const origins = [
      ...new Set(
        products
          .map((p) => p.Origin?.trim())
          .filter((o): o is string => Boolean(o) && o !== "N'")
      )
    ].sort();

    return {
      type: 'origin',
      label: 'Xuất xứ',
      values: origins.map((o) => ({
        displayText: o,
        queryFragment: { type: 'origin' as const, match: o }
      }))
    };
  }

  // ── Concentration ───────────────────────────────────────────────
  private async getConcentrationValues(): Promise<SurveyAttributeValuesResponse> {
    const concentrations = await this.prisma.concentrations.findMany({
      select: { Name: true },
      orderBy: { Name: 'asc' }
    });

    return {
      type: 'concentration',
      label: 'Nồng độ',
      values: concentrations
        .filter((c) => c.Name && c.Name !== "N'")
        .map((c) => ({
          displayText: c.Name,
          queryFragment: { type: 'concentration' as const, match: c.Name }
        }))
    };
  }

  // ── Scent Note ──────────────────────────────────────────────────
  private async getNoteValues(): Promise<SurveyAttributeValuesResponse> {
    const notes = await this.prisma.scentNotes.findMany({
      select: { Name: true },
      orderBy: { Name: 'asc' },
      take: 200
    });

    return {
      type: 'note',
      label: 'Nốt hương',
      values: notes.map((n) => ({
        displayText: n.Name,
        queryFragment: { type: 'note' as const, match: n.Name }
      }))
    };
  }

  // ── Olfactory Family ───────────────────────────────────────────
  private async getFamilyValues(): Promise<SurveyAttributeValuesResponse> {
    const families = await this.prisma.olfactoryFamilies.findMany({
      select: { Name: true },
      orderBy: { Name: 'asc' }
    });

    return {
      type: 'family',
      label: 'Nhóm hương',
      values: families.map((f) => ({
        displayText: f.Name,
        queryFragment: { type: 'family' as const, match: f.Name }
      }))
    };
  }

  // ── Product Attributes (grouped by attribute name) ──────────────
  private async getProductAttributeValues(): Promise<SurveyAttributeValuesResponse> {
    const attributes = await this.prisma.attributes.findMany({
      include: { AttributeValues: true },
      orderBy: { Name: 'asc' }
    });

    return {
      type: 'attribute',
      label: 'Thuộc tính sản phẩm',
      subGroups: attributes.map((attr) => ({
        attributeName: attr.Name,
        values: attr.AttributeValues.map((val) => ({
          displayText: val.Value,
          queryFragment: {
            type: 'attribute' as const,
            attributeName: attr.Name,
            match: val.Value
          }
        }))
      }))
    };
  }

  // ── Budget presets ─────────────────────────────────────────────
  private getBudgetPresets(): SurveyAttributeValuesResponse {
    return {
      type: 'budget',
      label: 'Ngân sách',
      values: [
        {
          displayText: 'Dưới 500.000đ',
          queryFragment: { type: 'budget' as const, max: 500000 }
        },
        {
          displayText: '500.000đ - 1.000.000đ',
          queryFragment: { type: 'budget' as const, min: 500000, max: 1000000 }
        },
        {
          displayText: '1.000.000đ - 2.000.000đ',
          queryFragment: { type: 'budget' as const, min: 1000000, max: 2000000 }
        },
        {
          displayText: '2.000.000đ - 5.000.000đ',
          queryFragment: { type: 'budget' as const, min: 2000000, max: 5000000 }
        },
        {
          displayText: 'Trên 5.000.000đ',
          queryFragment: { type: 'budget' as const, min: 5000000 }
        }
      ]
    };
  }
}
