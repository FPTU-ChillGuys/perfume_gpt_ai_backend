import { HttpService } from '@nestjs/axios';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import { funcHandlerAsync } from '../utils/error-handler';
import { firstValueFrom } from 'rxjs';
import ApiUrl from '../api/api_url';
import { id } from 'zod/v4/locales';

export class UserService {
  constructor(private readonly httpService: HttpService) {}

  async getEmailById(userId: string): Promise<BaseResponseAPI<String>> {
    return await funcHandlerAsync(
      async () => {
        const { data } = await firstValueFrom(
          this.httpService.get<BaseResponseAPI<String>>(
            ApiUrl().USER_URL('email/' + userId)
          )
        );
        return data;
      },
      'Failed to fetch user email',
      true
    );
  }
}
