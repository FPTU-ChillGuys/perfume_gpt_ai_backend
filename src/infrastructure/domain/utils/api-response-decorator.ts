import { Type, applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';

type PrimitiveClass = typeof String | typeof Number | typeof Boolean;

type SchemaDefinition = Record<string, unknown>;

const primitiveSchemaMap: Record<string, SchemaDefinition> = {
  String: { type: 'string' },
  Number: { type: 'number' },
  Boolean: { type: 'boolean' },
  Object: { type: 'object', additionalProperties: true }
};

const isPrimitive = (cls: Type<unknown> | PrimitiveClass): cls is PrimitiveClass =>
  cls === String || cls === Number || cls === Boolean;

const resolveSchema = (cls: Type<unknown> | PrimitiveClass): SchemaDefinition =>
  isPrimitive(cls) ? primitiveSchemaMap[cls.name] : { $ref: getSchemaPath(cls) };

interface PropertyOverrides {
  data?: SchemaDefinition;
  payload?: SchemaDefinition;
}

export const ApiBaseResponse = <T>(
  dataClass: Type<T> | PrimitiveClass,
  isArray: boolean = false,
  overrides?: PropertyOverrides
) => {
  const schemaData = resolveSchema(dataClass);
  const extraModels = isPrimitive(dataClass) ? [] : [dataClass as Type<unknown>];

  return applyDecorators(
    ApiExtraModels(BaseResponse, ...extraModels),
    ApiOkResponse({
      description: `The base response of ${dataClass.name}`,
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', description: 'Kết quả xử lý' },
          error: { type: 'string', nullable: true, description: 'Thông báo lỗi' },
          details: { type: 'string', nullable: true, description: 'Chi tiết lỗi' },
          data: overrides?.data ?? (isArray ? { type: 'array', items: schemaData } : schemaData)
        }
      }
    })
  );
};

export const ExtendApiBaseResponse = <T, I>(
  dataClass: Type<T> | PrimitiveClass,
  itemTypeOrIsArray?: Type<I> | PrimitiveClass | boolean,
  fallbackIsArray: boolean = false,
  overrides?: PropertyOverrides
) => {
  const secondArgIsBoolean = typeof itemTypeOrIsArray === 'boolean';
  const isArray = secondArgIsBoolean ? (itemTypeOrIsArray as boolean) : fallbackIsArray;
  const itemClass = secondArgIsBoolean ? undefined : (itemTypeOrIsArray as Type<I> | PrimitiveClass | undefined);

  const schemaData = resolveSchema(dataClass);
  const itemSchema = itemClass ? resolveSchema(itemClass) : null;

  let payloadSchema: SchemaDefinition = isArray ? { type: 'array', items: schemaData } : schemaData;

  if (itemClass && dataClass.name === 'PagedResult') {
    payloadSchema = {
      allOf: [
        { $ref: getSchemaPath(dataClass as Type<unknown>) },
        { properties: { items: { type: 'array', items: itemSchema } } }
      ]
    };
  }

  const extraModels: Type<unknown>[] = [];
  if (!isPrimitive(dataClass)) extraModels.push(dataClass as Type<unknown>);
  if (itemClass && !isPrimitive(itemClass)) extraModels.push(itemClass as Type<unknown>);

  return applyDecorators(
    ApiExtraModels(BaseResponseAPI, ...extraModels),
    ApiOkResponse({
      description: `The base response of ${dataClass.name}`,
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', description: 'Kết quả xử lý' },
          error: { type: 'string', nullable: true, description: 'Thông báo lỗi' },
          payload: overrides?.payload ?? payloadSchema
        }
      }
    })
  );
};