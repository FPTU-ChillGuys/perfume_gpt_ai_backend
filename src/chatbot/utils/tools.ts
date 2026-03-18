import { Injectable } from '@nestjs/common';
import { ToolSet } from 'ai';
import { ProductTool } from './tools/products.tool';
import { OrderTool } from './tools/orders.tool';
import { ProfileTool } from './tools/profile.tool';
import { LogTool } from './tools/log.tool';
import { ReviewTool } from './tools/review.tool';
import { UserTool } from './tools/user.tool';
import { InventoryTool } from './tools/inventory.tool';

@Injectable()
export class Tools {
  getTools: ToolSet;
  getToolsForChatbot: ToolSet;
  getToolsForTrend: ToolSet;
  getToolsForRecomendationAndRepurchase: ToolSet;
  getToolsForRestock: ToolSet;

  constructor(
    private readonly productTool: ProductTool,
    private readonly orderTool: OrderTool,
    private readonly profileTool: ProfileTool,
    private readonly logTool: LogTool,
    private readonly reviewTool: ReviewTool,
    private readonly userTool: UserTool,
    private readonly inventoryTool: InventoryTool
  ) {
    this.getToolsForChatbot = {
      getAllProducts: this.productTool.getAllProducts,
      searchProduct: this.productTool.searchProduct,
      getNewestProducts: this.productTool.getNewestProducts,
      getBestSellingProducts: this.productTool.getBestSellingProducts,
      // Order tools
      // getAllOrders: this.orderTool.getAllOrders,
      getOrdersByUserId: this.orderTool.getOrdersByUserId,
      addCartItems: this.orderTool.addCartItems,
      getOwnProfile: this.profileTool.getOwnProfile,
      productDetailTabContent: this.productTool.productDetailTabContent,
      getUserLogSummaryByUserId: this.logTool.getUserLogSummaryByUserId
    };

    this.getToolsForTrend = {
      // getAllProducts: this.productTool.getAllProducts,
      searchProduct: this.productTool.searchProduct,
      getNewestProducts: this.productTool.getNewestProducts,
      getBestSellingProducts: this.productTool.getBestSellingProducts,
      getUserLogSummaryByWeek: this.logTool.getUserLogSummaryByWeek
    };

    this.getToolsForRestock = {
      getInventoryStock: this.inventoryTool.getInventoryStock,
      getLatestTrendLogs: this.inventoryTool.getLatestTrendLogs
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
      getUserLogSummary: this.logTool.getUserLogSummary,
      getUserById: this.userTool.getUserById
    };
  }
}
