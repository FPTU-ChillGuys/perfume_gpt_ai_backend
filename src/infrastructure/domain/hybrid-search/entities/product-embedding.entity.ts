import { Entity, PrimaryKey, Property, Index } from '@mikro-orm/core';
import { ApiProperty } from '@nestjs/swagger';
import { Common } from '../../../../domain/entities/common/common.entities';

/**
 * Entity lưu embeddings của products trong PostgreSQL
 * Dùng cho vector search trong Hybrid Search v4
 */
@Entity({ tableName: 'product_embeddings' })
@Index({ properties: ['productId'] })
export class ProductEmbedding extends Common {
  /** UUID của product từ SQL Server */
  @ApiProperty({ description: 'UUID của product từ SQL Server', format: 'uuid' })
  @Property({ type: 'text' })
  productId!: string;

  /** Vector embedding (1536 dimensions cho text-embedding-3-small) */
  @ApiProperty({ description: 'Vector embedding (1536 dimensions)' })
  @Property({ type: 'floatvector', columnType: 'vector(1536)' })
  vector!: number[];

  /** Text mô tả đã được dùng để generate embedding (để debug/rebuild) */
  @ApiProperty({ description: 'Text mô tả đã được dùng để generate embedding' })
  @Property({ type: 'text' })
  description!: string;
}
