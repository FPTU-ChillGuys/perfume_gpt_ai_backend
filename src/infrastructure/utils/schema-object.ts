import { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

export const UIMessageSchemaObject: SchemaObject = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      id: { type: 'string', example: 'msg-1' },
      role: { type: 'string', example: 'user' },
      parts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', example: 'text' },
            text: { type: 'string', example: 'Xin chào AI!' }
          }
        }
      }
    }
  }
};
