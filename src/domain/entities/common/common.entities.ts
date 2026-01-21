import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Entity()
export class Common {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'newid()' })
  id!: string;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
