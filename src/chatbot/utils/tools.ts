import { Injectable } from '@nestjs/common';
import { ToolSet } from 'ai';
import { ProductTool } from './tools/products.tool';
import { OrderTool } from './tools/orders.tool';
import { ProfileTool } from './tools/profile.tool';
import { LogTool } from './tools/log.tool';
import { ReviewTool } from './tools/review.tool';
import { UserTool } from './tools/user.tool';
import { InventoryTool } from './tools/inventory.tool';
import { MasterDataTool } from './tools/master-data.tool';

@Injectable()
export class Tools {
  getTools: ToolSet;
  getToolsForChatbot: ToolSet;
  getToolsForTrend: ToolSet;
  getToolsForAnalysis: ToolSet;
  getToolsForRecomendationAndRepurchase: ToolSet;
  getToolsForRestock: ToolSet;
  getToolsForSurvey: ToolSet;
  getToolsForInventoryReport: ToolSet;
  getToolsForReview: ToolSet;

  constructor(
    private readonly productTool: ProductTool,
    private readonly orderTool: OrderTool,
    private readonly profileTool: ProfileTool,
    private readonly logTool: LogTool,
    private readonly reviewTool: ReviewTool,
    private readonly userTool: UserTool,
    private readonly inventoryTool: InventoryTool,
    private readonly masterDataTool: MasterDataTool
  ) {
    this.getToolsForChatbot = {
      // getAllProducts: this.productTool.getAllProducts,
      // searchProduct: this.productTool.searchProduct,
      // queryProducts: this.productTool.queryProducts,
      // getNewestProducts: this.productTool.getNewestProducts,
      // getBestSellingProducts: this.productTool.getBestSellingProducts,
      // // Order tools
      // getAllOrders: this.orderTool.getAllOrders,
      getOrdersByUserId: this.orderTool.getOrdersByUserId,
      addCartItems: this.orderTool.addCartItems,
      getOwnProfile: this.profileTool.getOwnProfile,
      getStaticProductPolicy: this.productTool.getStaticProductPolicy,
      getUserLogSummaryByUserId: this.logTool.getUserLogSummaryByUserId
    };

    this.getToolsForAnalysis = {
      normalizeKeyword: this.masterDataTool.normalizeKeyword,
      searchMasterData: this.masterDataTool.searchMasterData,
      getAvailableAttributes: this.masterDataTool.getAvailableAttributes
    };

    this.getToolsForSurvey = {
      getAllProducts: this.productTool.getAllProducts,
      searchProduct: this.productTool.searchProduct,
      queryProducts: this.productTool.queryProducts,
      getNewestProducts: this.productTool.getNewestProducts,
      getBestSellingProducts: this.productTool.getBestSellingProducts,
      getInventoryStock: this.inventoryTool.getInventoryStock
    };

    this.getToolsForTrend = {
      searchProduct: this.productTool.searchProduct,
      queryProducts: this.productTool.queryProducts,
      getNewestProducts: this.productTool.getNewestProducts,
      getBestSellingProducts: this.productTool.getBestSellingProducts,
      getUserLogSummaryByWeek: this.logTool.getUserLogSummaryByWeek,
      getLatestTrendLogs: this.inventoryTool.getLatestTrendLogs,
      getProductSalesAnalyticsForTrend:
        this.inventoryTool.getProductSalesAnalyticsForTrend
    };

    this.getToolsForRestock = {
      getLatestTrendLogs: this.inventoryTool.getLatestTrendLogs,
      getProductSalesAnalyticsForRestock:
        this.inventoryTool.getProductSalesAnalyticsForRestock
    };

    this.getToolsForInventoryReport = {
      getLatestTrendLogs: this.inventoryTool.getLatestTrendLogs,
      getProductSalesAnalyticsForRestock:
        this.inventoryTool.getProductSalesAnalyticsForRestock
    };

    this.getToolsForRecomendationAndRepurchase = {
      getAllProducts: this.productTool.getAllProducts,
      searchProduct: this.productTool.searchProduct,
      queryProducts: this.productTool.queryProducts,
      getNewestProducts: this.productTool.getNewestProducts,
      getBestSellingProducts: this.productTool.getBestSellingProducts,
      getOrderDetailsWithOrdersByUserId:
        this.orderTool.getOrderDetailsWithOrdersByUserId,
      getOwnProfile: this.profileTool.getOwnProfile,
      // getUserById: this.profileTool.getUserById,
      getUserLogSummary: this.logTool.getUserLogSummary,
      getUserById: this.userTool.getUserById
    };

    this.getToolsForReview = {
      getReviewStatisticsByVariantId:
        this.reviewTool.getReviewStatisticsByVariantId,
      getReviewsByVariantId: this.reviewTool.getReviewsByVariantId
    };
  }
}
