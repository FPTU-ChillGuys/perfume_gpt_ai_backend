import { Injectable } from '@nestjs/common';
import { ToolSet } from 'ai';
import { ProductTool } from './tools/products.tool';
import { OrderTool } from './tools/orders.tool';
import { ProfileTool } from './tools/profile.tool';
import { LogTool } from './tools/log.tool';

@Injectable()
export class Tools {
  getTools: ToolSet;

  constructor(
    private readonly productTool: ProductTool,
    private readonly orderTool: OrderTool,
    private readonly profileTool: ProfileTool,
    private readonly logTool: LogTool
  ) {
    this.getTools = {
      // Product tools
      getAllProducts: this.productTool.getAllProducts,
      searchProduct: this.productTool.searchProduct,
      // Order tools
      // getAllOrders: this.orderTool.getAllOrders,
      getOrdersByUserId: this.orderTool.getOrdersByUserId,
      getOrderById: this.orderTool.getOrderById,
      getOrderDetailsWithOrdersByUserId: this.orderTool.getOrderDetailsWithOrdersByUserId,
      getOrderReport: this.orderTool.getOrderReport,
      // Profile tools
      getOwnProfile: this.profileTool.getOwnProfile,
      // Log tools
      getUserActivityReportPerWeek: this.logTool.getUserActivityReportPerWeek,
      getUserActivityReportPerMonth: this.logTool.getUserActivityReportPerMonth,
      getUserActivityReportPerYear: this.logTool.getUserActivityReportPerYear,
      getUserLogSummaryReportPerWeek: this.logTool.getUserLogSummaryReportPerWeek,
      getUserLogSummaryReportPerMonth: this.logTool.getUserLogSummaryReportPerMonth,
      getUserLogSummaryReportPerYear: this.logTool.getUserLogSummaryReportPerYear,
      getUserLogSummariesPerWeek: this.logTool.getUserLogSummariesPerWeek,
      getUserLogSummariesPerMonth: this.logTool.getUserLogSummariesPerMonth,
      getUserLogSummariesPerYear: this.logTool.getUserLogSummariesPerYear,
    };
  }
}
