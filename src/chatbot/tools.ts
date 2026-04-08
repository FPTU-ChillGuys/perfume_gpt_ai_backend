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
  get getToolsForChatbot(): ToolSet {
    if (!this.productTool || !this.orderTool || !this.logTool || !this.cartTool) return {};
    return {
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
  }

  get getToolsForAnalysis(): ToolSet {
    if (!this.masterDataTool) return {};
    return {
      getProductNormalizationContext: this.masterDataTool.getProductNormalizationContext,
      searchMasterData: this.masterDataTool.searchMasterData,
    };
  }

  get getToolsForSurvey(): ToolSet {
    if (!this.productTool || !this.inventoryTool) return {};
    return {
      getAllProducts: this.productTool.getAllProducts,
      searchProduct: this.productTool.searchProduct,
      queryProducts: this.productTool.queryProducts,
      getNewestProducts: this.productTool.getNewestProducts,
      getBestSellingProducts: this.productTool.getBestSellingProducts,
      getInventoryStock: this.inventoryTool.getInventoryStock
    };
  }

  get getToolsForTrend(): ToolSet {
    if (!this.productTool || !this.logTool || !this.inventoryTool) return {};
    return {
      searchProduct: this.productTool.searchProduct,
      queryProducts: this.productTool.queryProducts,
      getNewestProducts: this.productTool.getNewestProducts,
      getBestSellingProducts: this.productTool.getBestSellingProducts,
      getUserLogSummaryByWeek: this.logTool.getUserLogSummaryByWeek,
      getLatestTrendLogs: this.inventoryTool.getLatestTrendLogs,
      getProductSalesAnalyticsForTrend:
        this.inventoryTool.getProductSalesAnalyticsForTrend
    };
  }

  get getToolsForRestock(): ToolSet {
    if (!this.inventoryTool) return {};
    return {
      getInventoryStock: this.inventoryTool.getInventoryStock,
      getLatestTrendLogs: this.inventoryTool.getLatestTrendLogs,
      getProductSalesAnalyticsForRestock:
        this.inventoryTool.getProductSalesAnalyticsForRestock
    };
  }

  get getToolsForInventoryReport(): ToolSet {
    if (!this.inventoryTool) return {};
    return {
      getLatestTrendLogs: this.inventoryTool.getLatestTrendLogs,
      getProductSalesAnalyticsForRestock:
        this.inventoryTool.getProductSalesAnalyticsForRestock
    };
  }

  get getToolsForRecomendationAndRepurchase(): ToolSet {
    if (!this.productTool || !this.orderTool || !this.profileTool || !this.logTool || !this.userTool) return {};
    return {
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
  }

  get getToolsForReview(): ToolSet {
    if (!this.reviewTool) return {};
    return {
      getReviewStatisticsByVariantId:
        this.reviewTool.getReviewStatisticsByVariantId,
      getReviewsByVariantId: this.reviewTool.getReviewsByVariantId
    };
  }

  get getTools(): ToolSet {
    return {
      ...this.getToolsForChatbot,
      ...this.getToolsForTrend
    };
  }

  private productTool?: ProductTool;
  private orderTool?: OrderTool;
  private profileTool?: ProfileTool;
  private logTool?: LogTool;
  private reviewTool?: ReviewTool;
  private userTool?: UserTool;
  private inventoryTool?: InventoryTool;
  private masterDataTool?: MasterDataTool;
  private cartTool?: CartTool;

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
  }

}
