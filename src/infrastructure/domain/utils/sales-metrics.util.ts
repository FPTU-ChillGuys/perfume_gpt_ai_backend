import {
  DailySalesRecord,
  SalesMetrics
} from 'src/application/dtos/response/variant-sales-analytics.response';
import { encode } from '@toon-format/toon';

/**
 * Tính toán metrics tối ưu cho LLM từ dữ liệu bán hàng hàng ngày
 * Giảm token bằng cách pre-compute thay vì gửi raw data
 *
 * @param dailySalesData Mảng dữ liệu bán hàng theo ngày
 * @returns SalesMetrics chứa: last7Days, last30Days, trend, volatility, encodedData
 */
export function calculateSalesMetrics(
  dailySalesData: DailySalesRecord[]
): SalesMetrics {
  if (dailySalesData.length === 0) {
    return {
      last7DaysSales: 0,
      last30DaysSales: 0,
      trend: 'STABLE',
      volatility: 'LOW',
      encodedData: null
    };
  }

  // Tính sales of last 7 days
  const last7Days = dailySalesData.slice(-7);
  const last7DaysSales = last7Days.reduce((sum, r) => sum + r.quantitySold, 0);

  // Tính sales of last 30 days
  const last30Days = dailySalesData.slice(-30);
  const last30DaysSales = last30Days.reduce(
    (sum, r) => sum + r.quantitySold,
    0
  );

  // Tính trend: so sánh first 15 days vs last 15 days
  const midpoint = Math.floor(dailySalesData.length / 2);
  const firstHalf = dailySalesData.slice(0, midpoint);
  const secondHalf = dailySalesData.slice(midpoint);

  const firstHalfAvg =
    firstHalf.length > 0
      ? firstHalf.reduce((sum, r) => sum + r.quantitySold, 0) / firstHalf.length
      : 0;
  const secondHalfAvg =
    secondHalf.length > 0
      ? secondHalf.reduce((sum, r) => sum + r.quantitySold, 0) /
        secondHalf.length
      : 0;

  let trend: 'INCREASING' | 'STABLE' | 'DECLINING' = 'STABLE';
  if (secondHalfAvg > firstHalfAvg * 1.15) {
    trend = 'INCREASING';
  } else if (secondHalfAvg < firstHalfAvg * 0.85) {
    trend = 'DECLINING';
  }

  // Tính volatility: dùng coefficient of variation trên last 7 days
  let volatility: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  if (last7Days.length > 1) {
    const mean = last7DaysSales / last7Days.length;
    const variance =
      last7Days.reduce(
        (sum, r) => sum + Math.pow(r.quantitySold - mean, 2),
        0
      ) / last7Days.length;
    const stdDev = Math.sqrt(variance);
    const cv = mean > 0 ? stdDev / mean : 0;

    if (cv > 0.5) volatility = 'HIGH';
    else if (cv > 0.25) volatility = 'MEDIUM';
  }

  // Encode dailySalesData using TOON format để giảm token
  const encodedData = encodeSalesData(dailySalesData);

  return {
    last7DaysSales,
    last30DaysSales,
    trend,
    volatility,
    encodedData
  };
}

/**
 * Encode dailySalesData using TOON format
 * Giảm đáng kể token count so với JSON format
 *
 * @param dailySalesData Mảng dữ liệu bán hàng theo ngày
 * @returns Encoded string hoặc null nếu encode fail
 */
export function encodeSalesData(
  dailySalesData: DailySalesRecord[]
): string | null {
  try {
    // Chuyển đổi sang format nhẹ hơn trước khi encode
    const lightData = dailySalesData.map((r) => ({
      d: r.date,
      q: r.quantitySold,
      r: r.revenue
    }));
    return encode(lightData);
  } catch {
    // Fallback nếu TOON encode fail
    return null;
  }
}
