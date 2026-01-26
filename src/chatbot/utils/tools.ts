import { Injectable } from '@nestjs/common';
import { ToolSet } from 'ai';
import { ProductTool } from './tools/products.tool';

@Injectable()
export class Tools {
  getTools: ToolSet;

  constructor(private readonly productTool: ProductTool) {
    this.getTools = {
      getAllProducts: this.productTool.getAllProducts,
      searchProduct: this.productTool.searchProduct
    };
  }
}
