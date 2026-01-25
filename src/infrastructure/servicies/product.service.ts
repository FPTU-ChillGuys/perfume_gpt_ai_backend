import { HttpService } from '@nestjs/axios';

export class ProductService {
  constructor(private readonly httpService: HttpService) {}
}
