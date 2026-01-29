import { applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';

export const ApiBaseResponse = <GenericType extends Function>(
  data: GenericType,
) =>
  applyDecorators(
    ApiExtraModels(BaseResponse, data),
    ApiOkResponse({
      description: `The base response of ${data.name}`,
      schema: {
        allOf: [
          { $ref: getSchemaPath(BaseResponse) },
          {
            properties: {
              data: {
                $ref: getSchemaPath(data)
              }
            }
          }
        ]
      }
    })
  );


  export const ExtendApiBaseResponse = <GenericType extends Function>(
  data: GenericType,
) =>
  applyDecorators(
    ApiExtraModels(BaseResponseAPI, data),
    ApiOkResponse({
      description: `The base response of ${data.name}`,
      schema: {
        allOf: [
          { $ref: getSchemaPath(BaseResponseAPI) },
          {
            properties: {
              payload: {
                $ref: getSchemaPath(data)
              }
            }
          }
        ]
      }
    })
  );
