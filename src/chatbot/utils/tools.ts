import { Injectable } from '@nestjs/common';
import { ToolSet } from 'ai';
import { ProductTool } from './tools/products.tool';
import { OrderTool } from './tools/orders.tool';
import { ProfileTool } from './tools/profile.tool';
import { LogTool } from './tools/log.tool';
import { ReviewTool } from './tools/review.tool';
import { UserTool } from './tools/user.tool';

@Injectable()
export class Tools {
  getTools: ToolSet;
  getToolsForChatbot: ToolSet;
  getToolsForTrend: ToolSet;
  getToolsForRecomendationAndRepurchase: ToolSet;

  constructor(
    private readonly productTool: ProductTool,
    private readonly orderTool: OrderTool,
    private readonly profileTool: ProfileTool,
    private readonly logTool: LogTool,
    private readonly reviewTool: ReviewTool,
    private readonly userTool: UserTool
  ) {
    this.getToolsForChatbot = {
      getAllProducts: this.productTool.getAllProducts,
      searchProduct: this.productTool.searchProduct,
      getNewestProducts: this.productTool.getNewestProducts,
      getBestSellingProducts: this.productTool.getBestSellingProducts,
      // Order tools
      // getAllOrders: this.orderTool.getAllOrders,
      getOrdersByUserId: this.orderTool.getOrdersByUserId,
      getOwnProfile: this.profileTool.getOwnProfile,
      productDetailTabContent: this.productTool.productDetailTabContent,
      getAggregatedUserLogSummary: this.logTool.getAggregatedUserLogSummary,
    };

    this.getToolsForTrend = {
      getAllProducts: this.productTool.getAllProducts,
      searchProduct: this.productTool.searchProduct,
      getNewestProducts: this.productTool.getNewestProducts,
      getBestSellingProducts: this.productTool.getBestSellingProducts,
      getAggregatedUserLogSummary : this.logTool.getAggregatedUserLogSummary
    };

    this.getToolsForRecomendationAndRepurchase = {
      getAllProducts: this.productTool.getAllProducts,
      searchProduct: this.productTool.searchProduct,
      getNewestProducts: this.productTool.getNewestProducts,
      getBestSellingProducts: this.productTool.getBestSellingProducts,
      getOrderDetailsWithOrdersByUserId:
        this.orderTool.getOrderDetailsWithOrdersByUserId,
      getOwnProfile: this.profileTool.getOwnProfile,
      // getUserById: this.profileTool.getUserById,
      getAggregatedUserLogSummary: this.logTool.getAggregatedUserLogSummary,
      getUserById: this.userTool.getUserById
    };

    this.getTools = {
      // Product tools
      getAllProducts: this.productTool.getAllProducts,
      searchProduct: this.productTool.searchProduct,
      getNewestProducts: this.productTool.getNewestProducts,
      getBestSellingProducts: this.productTool.getBestSellingProducts,
      // Order tools
      // getAllOrders: this.orderTool.getAllOrders,
      getOrdersByUserId: this.orderTool.getOrdersByUserId,
      // getOrderById: this.orderTool.getOrderById,
      getOrderDetailsWithOrdersByUserId:
        this.orderTool.getOrderDetailsWithOrdersByUserId,
      // getOrderReport: this.orderTool.getOrderReport,
      // Profile tools
      getOwnProfile: this.profileTool.getOwnProfile,
      // Log tools
      getUserActivityReportPerWeek: this.logTool.getUserActivityReportPerWeek,
      // getUserActivityReportPerMonth: this.logTool.getUserActivityReportPerMonth,
      // getUserActivityReportPerYear: this.logTool.getUserActivityReportPerYear,
      getUserLogSummaryReport: this.logTool.getUserLogSummaryReport,
      getUserLogSummaries: this.logTool.getUserLogSummaries,
      // Review tools
      getReviewsByVariantId: this.reviewTool.getReviewsByVariantId,
      getReviewStatisticsByVariantId:
        this.reviewTool.getReviewStatisticsByVariantId,
      getPagedReviews: this.reviewTool.getPagedReviews
    };
  }
}
