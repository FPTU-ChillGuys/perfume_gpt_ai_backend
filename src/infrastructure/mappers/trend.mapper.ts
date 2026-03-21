import {
  AITrendItemStructuredResponse,
  AITrendSignalStructuredResponse
} from 'src/application/dtos/response/ai-structured.response';
import { ProductResponse } from 'src/application/dtos/response/product.response';
import { ProductWithVariantsResponse } from 'src/application/dtos/response/product-with-variants.response';

type TrendProductOutputShape = {
  id: string;
  name: string;
  description: string;
  brandName: string;
  categoryName: string;
  primaryImage: string | null;
  attributes: Array<{
    attribute: string;
    value: string;
    desciption: string | null;
  }>;
  variants: Array<{
    id: string;
    sku: string;
    volumeMl: number;
    type: string;
    basePrice: number;
    status: string;
    concentrationName: string | null;
    totalQuantity: number | null;
    reservedQuantity: number | null;
  }>;
};

type RankedTrendItem = {
  productId: string;
  productName: string;
  product: ProductWithVariantsResponse;
  representativeVariantId: string | null;
  trendScore: number;
  confidence: number;
  badgeType: 'Rising' | 'New' | 'Stable';
  reasonCodes: string[];
  last7DaysSales: number;
  last30DaysSales: number;
};

const REASON_CODE_DESCRIPTION: Record<string, string> = {
  BEST_SELLER_SUPPORT: 'Sản phẩm được hỗ trợ bởi dữ liệu bán chạy.',
  NEW_ARRIVAL_BOOST: 'Sản phẩm mới ra mắt và đang có tín hiệu quan tâm tốt.',
  SALES_MOMENTUM_UP: 'Doanh số 7 ngày tăng mạnh so với nền 30 ngày.',
  SALES_TREND_INCREASING: 'Xu hướng bán hàng tổng thể đang tăng.',
  USER_INTEREST_SIGNAL: 'Tín hiệu hành vi người dùng cho thấy mức quan tâm cao.',
  RECENT_TREND_SNAPSHOT_MATCH: 'Có xuất hiện trong snapshot xu hướng gần nhất.',
  VOLATILITY_RISK: 'Độ biến động doanh số cao, cần theo dõi rủi ro.'
};

export class TrendMapper {
  static mapProductToTrendOutputShape(
    product: ProductWithVariantsResponse
  ): TrendProductOutputShape {
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      brandName: product.brandName,
      categoryName: product.categoryName,
      primaryImage: product.primaryImage,
      attributes: (product.attributes ?? []).map((attr) => ({
        attribute: attr.attribute,
        value: attr.value,
        desciption: attr.description ?? null
      })),
      variants: (product.variants ?? []).map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        volumeMl: variant.volumeMl,
        type: variant.type,
        basePrice: variant.basePrice,
        status: variant.status,
        concentrationName: variant.concentration?.name ?? null,
        totalQuantity: variant.stock?.totalQuantity ?? null,
        reservedQuantity: variant.stock?.reservedQuantity ?? null
      }))
    };
  }

  static mapRankedItemsToProductResponse(
    rankedItems: RankedTrendItem[]
  ): ProductResponse[] {
    return rankedItems.map((item) => ({
      id: item.product.id,
      name: item.product.name,
      brandId: item.product.brandId,
      brandName: item.product.brandName,
      categoryId: item.product.categoryId,
      categoryName: item.product.categoryName,
      description: item.product.description,
      primaryImage: item.product.primaryImage,
      attributes: item.product.attributes ?? []
    }));
  }

  static mapTrendItemsForStructuredResponse(
    rankedItems: RankedTrendItem[]
  ): AITrendItemStructuredResponse[] {
    return rankedItems.map(
      (item) =>
        new AITrendItemStructuredResponse({
          productId: item.productId,
          productName: item.productName,
          variantId: item.representativeVariantId,
          trendScore: item.trendScore,
          confidence: item.confidence,
          badgeType: item.badgeType,
          last7DaysSales: item.last7DaysSales,
          last30DaysSales: item.last30DaysSales,
          signals: item.reasonCodes.map(
            (code) =>
              new AITrendSignalStructuredResponse({
                code,
                description:
                  REASON_CODE_DESCRIPTION[code] ??
                  'Tín hiệu hỗ trợ bổ sung từ hệ thống chấm điểm trend.'
              })
          )
        })
    );
  }
}

export type { TrendProductOutputShape, RankedTrendItem };
export { REASON_CODE_DESCRIPTION };
