import { ApiProperty } from '@nestjs/swagger';
import 'reflect-metadata';

export function AutoApiProperties(): ClassDecorator {
  return (target: any) => {
    const properties = Object.getOwnPropertyNames(new target());

    for (const property of properties) {
      const type = Reflect.getMetadata(
        'design:type',
        target.prototype,
        property
      );

      ApiProperty({ type })(target.prototype, property);
    }
  };
}
