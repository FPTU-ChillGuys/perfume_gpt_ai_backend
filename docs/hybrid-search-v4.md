# Hybrid Search v4 - Documentation

## Tổng quan

Hybrid Search v4 là hệ thống tìm kiếm lai kết hợp **Query Layer** (hard filters) và **Vector Layer** (similarity search) để tối ưu độ chính xác và trải nghiệm người dùng.

### Kiến trúc 2 lớp

```
┌─────────────────────────────────────────────────────────────┐
│                    Search Input                              │
│              "Nước hoa nữ mùi ngọt dưới 1.5 triệu"           │
└─────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            │                               │
            ▼                               ▼
┌───────────────────────┐      ┌──────────────────────────┐
│   Query Layer         │      │   Vector Layer           │
│   (Hard Filters)      │      │   (Similarity Search)    │
│                       │      │                          │
│   - Price: ≤ 1.5M     │      │   - Embedding generation │
│   - Gender: Nữ        │      │   - Cosine similarity    │
│   - Year: 2020+       │      │   - Product ranking      │
│   - Origin: Pháp      │      │                          │
└───────────────────────┘      └──────────────────────────┘
            │                               │
            └───────────────┬───────────────┘
                            │
                            ▼
              ┌──────────────────────────┐
              │      Merge Layer         │
              │                          │
              │  - Intersection filter   │
              │  - Sort by similarity    │
              │  - Pagination            │
              └──────────────────────────┘
                            │
                            ▼
              ┌──────────────────────────┐
              │      Response            │
              │  Products + Similarity   │
              └──────────────────────────┘
```

## Component Chi tiết

### 1. Query Layer (Hard Filters)

**Mục đích**: Xử lý các thuộc tính cần độ chính xác tuyệt đối mà vector search không thể làm được.

**Các normalizers**:
- **PriceNormalizer**: Extract giá cả (dưới, trên, khoảng, giữa)
- **GenderNormalizer**: Chuẩn hóa giới tính (Nam/Nữ/Unisex)
- **YearNormalizer**: Extract năm ra mắt
- **OriginNormalizer**: Extract nguồn gốc (Pháp, Mỹ, Nhật, v.v.)

**Cách hoạt động**:
1. AI phân tích search text → extract filters
2. Build Prisma WHERE clause
3. Query DB → lấy list product IDs
4. Nếu không có filter → `null` (không filter)

### 2. Vector Layer (Similarity Search)

**Mục đích**: Tìm kiếm semantic similarity cho các thuộc tính tương đối.

**Embedding model**: `openai/text-embedding-3-small` (1536 dimensions) qua OpenRouter

**Storage**: PostgreSQL với pgvector extension

**Description template**:
```
Nước hoa [Name] thương hiệu [Brand], xuất xứ [Origin], ra mắt năm [Year].
Giới tính: [Gender].
Các tầng hương: [top notes], [heart notes], [base notes].
Phong cách: [olfactory families].
Nồng độ: [concentration].
Độ lưu hương: [longevity]/10.
Độ tỏa hương: [sillage]/10.
Mô tả: [description].
```

**Lưu ý**: Description chỉ bao gồm thuộc tính TƯƠNG ĐỐI, KHÔNG bao gồm giá, year, gender (đã có query layer lo).

### 3. Merge Layer

**Logic**:
1. Nếu Query Layer có filters → Intersection với Vector Layer results
2. Nếu Intersection rỗng → Trả về empty (theo decision)
3. Sort theo vector similarity DESC
4. Apply pagination

## API Endpoints

### 1. Hybrid Search

```
GET /products/search/v4?searchText=...&PageNumber=1&PageSize=10
```

**Response**:
```json
{
  "success": true,
  "payload": {
    "items": [...],
    "totalCount": 50,
    "pageNumber": 1,
    "pageSize": 10,
    "queryFilters": {
      "price": { "max": 1500000, "operator": "lte" },
      "gender": { "value": "Nữ" }
    },
    "vectorSimilarity": true
  }
}
```

### 2. Rebuild Embeddings

```
POST /hybrid-search/embeddings/rebuild
```
Rebuild tất cả embeddings

```
POST /hybrid-search/embeddings/rebuild/:productId
```
Rebuild embedding cho 1 product cụ thể

```
DELETE /hybrid-search/embeddings/:productId
```
Xóa embedding của 1 product

```
GET /hybrid-search/embeddings/stats
```
Get stats về embeddings

## Setup & Installation

### 1. Cài đặt pgvector extension

```bash
# Chạy migration
pnpm run migration:run
```

Migration sẽ:
- Tạo extension `vector`
- Tạo table `product_embeddings`
- Tạo indexes (BTree cho productId, HNSW cho vector)

### 2. Generate embeddings ban đầu

```bash
# Rebuild tất cả embeddings
curl -X POST http://localhost:3000/hybrid-search/embeddings/rebuild
```

Hoặc dùng API endpoint trong app.

### 3. Test search

```bash
# Chạy test script
pnpm run test:search:v4
```

## Environment Variables

```env
OPENROUTER_API_KEY=sk-or-v1-...  # API key cho OpenRouter
SEARCH_V4_BASE_URL=http://localhost:3000  # Base URL cho test script
SEARCH_V4_INPUT=temp/test_queries_v4.txt  # Input file cho test
SEARCH_V4_OUTPUT=temp/search_v4_results.txt  # Output file cho test
```

## Testing

### Test queries mẫu

Tạo file `temp/test_queries_v4.txt`:
```
Nước hoa nữ mùi ngọt dưới 1.5 triệu
Dior Sauvage
Nước hoa unisex hương gỗ
Chanel dưới 2 triệu
Nước hoa nam mùi hăng
```

Chạy test:
```bash
pnpm run test:search:v4
```

## Performance Considerations

### Response time
- **Query Layer**: ~50-100ms (Prisma query)
- **Vector Layer**: ~1-2s (embedding generation + vector search)
- **Merge Layer**: ~10-50ms
- **Total**: ~1.5-3s

### Optimization strategies
1. **Caching embeddings**: Chưa implement (có thể thêm Redis cache)
2. **Batch embedding generation**: Có thể parallelize khi rebuild
3. **HNSW index**: Đã setup cho fast cosine similarity
4. **Lazy loading**: Chỉ load products cần thiết

## Future Improvements

### Phase 2 (Optional)
- [ ] Auto-sync embeddings (on product update)
- [ ] Redis caching cho query embeddings
- [ ] Multi-vector per product (name, scent, description riêng)
- [ ] Fallback strategy khi intersection rỗng
- [ ] Hybrid ranking (weighted combination)

### Phase 3 (Optional)
- [ ] A/B testing giữa v3 và v4
- [ ] Analytics & logging
- [ ] User feedback loop
- [ ] Adaptive weights

## Troubleshooting

### Error: "relation product_embeddings does not exist"
→ Chạy migration: `pnpm run migration:run`

### Error: "vector type not found"
→ Extension pgvector chưa được enable. Check:
```sql
SELECT * FROM pg_extension WHERE extname = 'vector';
```

### Error: "OpenRouter API key invalid"
→ Check `OPENROUTER_API_KEY` trong `.env`

### Empty results
→ Kiểm tra:
1. Embeddings đã được generate chưa: `GET /hybrid-search/embeddings/stats`
2. Query filters quá chặt → thử giảm filters
3. Vector similarity threshold quá cao

## Architecture Decisions

### Why PostgreSQL + pgvector?
- Native vector support
- Cosine similarity trong DB
- Already using PostgreSQL for MikroORM
- Better than in-memory cho large datasets

### Why OpenRouter?
- Already integrated trong project
- Access to OpenAI models
- Cost-effective

### Why single vector per product?
- Simpler implementation
- Easier to maintain
- Good enough cho MVP
- Multi-vector có thể add sau

### Why return empty on intersection failure?
- Strict filtering đảm bảo relevance
- User experience: better empty than irrelevant
- Có thể add fallback sau (relaxed filters)

## Files Structure

```
src/
├── infrastructure/
│   └── domain/
│       ├── hybrid-search/
│       │   ├── hybrid-search.module.ts
│       │   ├── hybrid-search.service.ts
│       │   ├── embedding.service.ts
│       │   ├── ai-models.ts
│       │   ├── entities/
│       │   │   └── product-embedding.entity.ts
│       │   └── normalizers/
│       │       ├── orchestrator.ts
│       │       ├── price.normalizer.ts
│       │       ├── gender.normalizer.ts
│       │       ├── year.normalizer.ts
│       │       └── origin.normalizer.ts
│       └── utils/
│           └── entities.ts (updated)
├── api/
│   ├── controllers/
│   │   ├── product.controller.ts (updated)
│   │   ├── rebuild-embeddings.controller.ts
│   │   └── modules/
│   │       └── rebuild-embeddings.module.ts
│   └── domain/
│       └── common/
│           └── list/
│               └── module.ts (updated)
├── migrations/
│   └── MigrationPgVectorSetup.ts
└── scripts/
    └── run-search-v4-test.ts
```

## License

Internal use only - Perfume GPT AI Backend
