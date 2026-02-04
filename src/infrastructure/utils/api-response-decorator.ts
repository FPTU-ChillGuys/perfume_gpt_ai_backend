import { applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';

// Map kiểu primitive
const primitiveMap: Record<string, any> = {
  String: { type: 'string' },
  Number: { type: 'number' },
  Boolean: { type: 'boolean' }
};

// Kiểm tra primitive
const isPrimitive = (data: any) =>
  data === String || data === Number || data === Boolean;

/**
 * =====================================================
 * ApiBaseResponse
 * =====================================================
 */
export const ApiBaseResponse = <T extends Function>(
  data: T,
  isArray: boolean = false,
  properties?: Record<string, any>
) => {
  const schemaData = isPrimitive(data)
    ? primitiveMap[data.name] // Primitive schema
    : { $ref: getSchemaPath(data) }; // DTO schema

  return applyDecorators(
    ApiExtraModels(BaseResponse, ...(isPrimitive(data) ? [] : [data])),
    ApiOkResponse({
      description: `The base response of ${data.name}`,
      schema: {
        allOf: [
          { $ref: getSchemaPath(BaseResponse) },
          {
            properties: properties ?? {
              data: isArray ? { type: 'array', items: schemaData } : schemaData
            }
          }
        ]
      }
    })
  );
};

/**
 * =====================================================
 * ExtendApiBaseResponse
 * =====================================================
 */
export const ExtendApiBaseResponse = <T extends Function>(
  data: T,
  isArray: boolean = false,
  properties?: Record<string, any>
) => {
  const schemaData = isPrimitive(data)
    ? primitiveMap[data.name]
    : { $ref: getSchemaPath(data) };

  return applyDecorators(
    ApiExtraModels(BaseResponseAPI, ...(isPrimitive(data) ? [] : [data])),
    ApiOkResponse({
      description: `The base response of ${data.name}`,
      schema: {
        allOf: [
          { $ref: getSchemaPath(BaseResponseAPI) },
          {
            properties: properties ?? {
              data: isArray ? { type: 'array', items: schemaData } : schemaData
            }
          }
        ]
      }
    })
  );
};
