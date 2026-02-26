import { Injectable } from '@nestjs/common';
import { ToolSet } from 'ai';
import { ProductTool } from './tools/products.tool';
import { OrderTool } from './tools/orders.tool';
import { ProfileTool } from './tools/profile.tool';

@Injectable()
export class Tools {
  getTools: ToolSet;

  constructor(
    private readonly productTool: ProductTool,
    private readonly orderTool: OrderTool,
    private readonly profileTool: ProfileTool
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
      // createProfileReport: this.profileTool.createProfileReport,
      // createSystemPromptFromProfile: this.profileTool.createSystemPromptFromProfile
    };
  }
}
