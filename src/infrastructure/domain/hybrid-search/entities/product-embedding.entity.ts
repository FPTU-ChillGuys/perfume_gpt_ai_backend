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

  /** Vector embedding (1024 dimensions cho FPT Vietnamese_Embedding) */
  @ApiProperty({ description: 'Vector embedding (1024 dimensions)' })
  @Property({ type: 'floatvector', columnType: 'vector(1024)' })
  vector!: number[];

  /** Text mô tả đã được dùng để generate embedding (để debug/rebuild) */
  @ApiProperty({ description: 'Text mô tả đã được dùng để generate embedding', required: false, nullable: true })
  @Property({ type: 'text' })
  description?: string;

  /** Text dùng cho BM25 keyword search */
  @ApiProperty({ description: 'Text dùng cho BM25 keyword search' })
  @Property({ type: 'text', nullable: true })
  searchText?: string;
}
