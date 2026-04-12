# Hybrid Search v4 - Setup Guide

## Quick Start

### 1. Setup Database

```bash
# Chạy migration để tạo pgvector extension và table
pnpm run migration:run
```

Migration sẽ:
- ✅ Tạo extension `vector` trong PostgreSQL
- ✅ Tạo table `product_embeddings`
- ✅ Tạo indexes (BTree + HNSW)

### 2. Generate Embeddings Ban Đầu

```bash
# Option 1: Dùng API
curl -X POST http://localhost:3000/hybrid-search/embeddings/rebuild

# Option 2: Dùng script (nếu có)
pnpm run rebuild:embeddings
```

### 3. Chạy Application

```bash
# Build
pnpm run build

# Run
pnpm run start:dev
```

### 4. Test Search

```bash
# Test queries
curl "http://localhost:3000/products/search/v4?searchText=nước hoa nữ dưới 1.5 triệu"

# Chạy test script
pnpm run test:search:v4
```

## Environment Variables

Thêm vào `.env`:

```env
# OpenRouter API key (cho embedding generation)
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxx

# Optional: Test script configuration
SEARCH_V4_BASE_URL=http://localhost:3000
SEARCH_V4_INPUT=temp/test_queries_v4.txt
SEARCH_V4_OUTPUT=temp/search_v4_results.txt
```

## API Endpoints

### Hybrid Search

```
GET /products/search/v4?searchText=...&PageNumber=1&PageSize=10
```

**Query Parameters:**
- `searchText` (required): Text tìm kiếm
- `PageNumber` (optional): Số trang, default = 1
- `PageSize` (optional): Số lượng mỗi trang, default = 10

**Response:**
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

### Rebuild Embeddings

```bash
# Rebuild tất cả
POST /hybrid-search/embeddings/rebuild

# Rebuild 1 product
POST /hybrid-search/embeddings/rebuild/:productId

# Xóa embedding
DELETE /hybrid-search/embeddings/:productId

# Get stats
GET /hybrid-search/embeddings/stats
```

## Troubleshooting

### Error: "relation product_embeddings does not exist"

**Solution:** Chạy migration
```bash
pnpm run migration:run
```

### Error: "vector type not found"

**Solution:** Extension pgvector chưa được enable
```sql
-- Check trong psql
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Nếu chưa có, chạy:
CREATE EXTENSION IF NOT EXISTS vector;
```

### Error: "OpenRouter API key invalid"

**Solution:** Check `OPENROUTER_API_KEY` trong `.env`

### Empty results

**Check:**
1. Embeddings đã được generate: `GET /hybrid-search/embeddings/stats`
2. Query filters quá chặt → thử giảm filters
3. Vector similarity threshold quá cao

## Performance Tips

1. **Rebuild embeddings định kỳ**: Khi có product mới/update
2. **Monitor API costs**: OpenRouter embedding generation có cost
3. **Use pagination**: Limit pageSize để tránh load quá nhiều
4. **Cache query embeddings** (future): Nếu cùng query được search nhiều lần

## Next Steps

- [ ] Auto-sync embeddings khi product update
- [ ] Redis caching cho query embeddings
- [ ] Multi-vector per product
- [ ] Fallback strategy khi intersection rỗng

## Documentation

- Full documentation: `docs/hybrid-search-v4.md`
- Test queries: `temp/test_queries_v4.txt`
- Test script: `scripts/run-search-v4-test.ts`
