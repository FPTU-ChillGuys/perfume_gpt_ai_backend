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
export const ExtendApiBaseResponse = <T extends Function, I extends Function>(
  data: T,
  itemTypeOrIsArray?: I | boolean,
  oldIsArray: boolean = false,
  properties?: Record<string, any>
) => {
  const isSecondArgBoolean = typeof itemTypeOrIsArray === 'boolean';
  const isArray = isSecondArgBoolean ? (itemTypeOrIsArray as boolean) : oldIsArray;
  const itemType = isSecondArgBoolean ? undefined : (itemTypeOrIsArray as I);

  const schemaData = isPrimitive(data)
    ? primitiveMap[data.name]
    : { $ref: getSchemaPath(data) };

  const itemSchema = itemType ? (isPrimitive(itemType) ? primitiveMap[itemType.name] : { $ref: getSchemaPath(itemType) }) : null;

  let payloadSchema: any = isArray ? { type: 'array', items: schemaData } : schemaData;

  // Nếu là PagedResult và có itemType, override items property
  if (itemType && data.name === 'PagedResult') {
    payloadSchema = {
      allOf: [
        { $ref: getSchemaPath(data) },
        {
          properties: {
            items: {
              type: 'array',
              items: itemSchema
            }
          }
        }
      ]
    };
  }

  return applyDecorators(
    ApiExtraModels(BaseResponseAPI, ...(isPrimitive(data) ? [] : [data]), ...(itemType && !isPrimitive(itemType) ? [itemType] : [])),
    ApiOkResponse({
      description: `The base response of ${data.name}`,
      schema: {
        allOf: [
          { $ref: getSchemaPath(BaseResponseAPI) },
          {
            properties: properties ?? {
              payload: payloadSchema
            }
          }
        ]
      }
    })
  );
};


