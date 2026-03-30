import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ToolSet } from 'ai';
import { ProductTool } from './tools/products.tool';
import { OrderTool } from './tools/orders.tool';
import { ProfileTool } from './tools/profile.tool';
import { LogTool } from './tools/log.tool';
import { ReviewTool } from './tools/review.tool';
import { UserTool } from './tools/user.tool';
import { InventoryTool } from './tools/inventory.tool';
import { MasterDataTool } from './tools/master-data.tool';
import { CartTool } from './tools/cart.tool';

@Injectable()
export class Tools implements OnModuleInit {
  getTools: ToolSet;
  getToolsForChatbot: ToolSet;
  getToolsForTrend: ToolSet;
  getToolsForAnalysis: ToolSet;
  getToolsForRecomendationAndRepurchase: ToolSet;
  getToolsForRestock: ToolSet;
  getToolsForSurvey: ToolSet;
  getToolsForInventoryReport: ToolSet;
  getToolsForReview: ToolSet;

  private productTool: ProductTool;
  private orderTool: OrderTool;
  private profileTool: ProfileTool;
  private logTool: LogTool;
  private reviewTool: ReviewTool;
  private userTool: UserTool;
  private inventoryTool: InventoryTool;
  private masterDataTool: MasterDataTool;
  private cartTool: CartTool;

  constructor(private readonly moduleRef: ModuleRef) { }

  onModuleInit() {
    this.productTool = this.moduleRef.get(ProductTool, { strict: false });
    this.orderTool = this.moduleRef.get(OrderTool, { strict: false });
    this.profileTool = this.moduleRef.get(ProfileTool, { strict: false });
    this.logTool = this.moduleRef.get(LogTool, { strict: false });
    this.reviewTool = this.moduleRef.get(ReviewTool, { strict: false });
    this.userTool = this.moduleRef.get(UserTool, { strict: false });
    this.inventoryTool = this.moduleRef.get(InventoryTool, { strict: false });
    this.masterDataTool = this.moduleRef.get(MasterDataTool, { strict: false });
    this.cartTool = this.moduleRef.get(CartTool, { strict: false });

    this.initializeToolSets();
  }

  private initializeToolSets() {
    this.getToolsForChatbot = {
      getNewestProducts: this.productTool.getNewestProducts,
      getBestSellingProducts: this.productTool.getBestSellingProducts,
      getLeastSellingProducts: this.productTool.getLeastSellingProducts,
      getOrdersByUserId: this.orderTool.getOrdersByUserId,
      getStaticProductPolicy: this.productTool.getStaticProductPolicy,
      getUserLogSummaryByUserId: this.logTool.getUserLogSummaryByUserId,
      addToCart: this.cartTool.addToCart,
      getCart: this.cartTool.getCart,
      clearCart: this.cartTool.clearCart,
    };

    this.getToolsForAnalysis = {
      searchMasterData: this.masterDataTool.searchMasterData,
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
