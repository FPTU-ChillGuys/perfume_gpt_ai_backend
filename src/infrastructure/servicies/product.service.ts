import { HttpService } from '@nestjs/axios';
import { PRODUCT_URL } from '../api/api_url';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import { ProductListResponse } from 'src/application/dtos/response/product.response';
import { firstValueFrom } from 'rxjs';
import { funcHandlerAsync } from '../utils/error-handler';

export class ProductService {
  constructor(private readonly httpService: HttpService) {}

  async getAllProducts() {
    return await funcHandlerAsync(async () => {
      const { data } = await firstValueFrom(
        this.httpService.get<BaseResponseAPI<ProductListResponse>>(
          PRODUCT_URL('')
        )
      );
      return data;
    }, 'Failed to fetch products');
  }
}
