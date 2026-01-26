import { Injectable } from '@nestjs/common';
import { ToolSet } from 'ai';
import { ProductTool } from './tools/products.tool';

@Injectable()
export class Tools {
  tools: ToolSet;

  constructor(private readonly productTool: ProductTool) {
    this.tools = {
      getAllProducts: this.productTool.getAllProducts
    };
  }
}
