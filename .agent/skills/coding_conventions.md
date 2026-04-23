# Skill: perfume_gpt_ai_backend — Quy Tắc Code & Kiến Trúc

> Đọc kỹ file này trước khi thực hiện bất kỳ thay đổi nào trong project.
> Mọi quy tắc bên dưới là bắt buộc tuân thủ, không có ngoại lệ.

---

## 1. Tổng Quan Kiến Trúc

```
src/
├── api/controllers/           # Chỉ nhận Request → gọi Service → trả Response
├── application/
│   ├── constant/prompts/      # Prompt constants, INSTRUCTION_TYPE_xxx
│   ├── dtos/request/          # DTOs nhận từ API
│   └── dtos/response/         # DTOs trả về API + Redis interfaces
├── chatbot/tools/             # AI Tool definitions (không chứa data access)
├── domain/entities/           # MikroORM entities
├── domain/enum/               # Enums
└── infrastructure/domain/
    ├── <domain>/service.ts    # Business logic ONLY
    ├── repositories/          # MikroORM repositories + UnitOfWork
    │   └── redis/             # Redis repositories (Pub/Sub wrappers)
    └── common/redis/          # RedisRequestResponseService (base layer)
```

---

## 2. Quy Tắc: Interface & DTO — TUYỆT ĐỐI KHÔNG để trong Service/Tool

### ❌ VI PHẠM — Đặt interface trong file service/tool:
```typescript
// TRONG inventory.service.ts — SAI
interface StockItem { variantId: string; totalQuantity: number; }
type RestockPayload = { variants?: StockItem[] };
```

### ✅ ĐÚNG — Đặt tất cả interfaces/types vào `src/application/dtos/`:
| Loại | Nơi đặt | Ví dụ |
|---|---|---|
| Response API | `dtos/response/<name>.response.ts` | `inventory-stock.response.ts` |
| Request API | `dtos/request/<name>.request.ts` | `inventory-stock.request.ts` |
| Redis nội bộ | `dtos/response/redis-internal.response.ts` | (tập trung 1 file duy nhất) |
| Type trong service | `dtos/response/<name>.response.ts` hoặc `redis-internal.response.ts` | Nếu là private type, extract ra file |

```typescript
// TRONG redis-internal.response.ts — ĐÚNG
export interface RedisInventoryStockResponse {
  variantId: string;
  totalQuantity: number;
  reservedQuantity: number;
  lowStockThreshold: number;
}

// TRONG inventory.service.ts — ĐÚNG: Import thay vì khai báo
import { RedisInventoryStockResponse } from 'src/application/dtos/response/redis-internal.response';
```

---

## 3. Quy Tắc: Repository Pattern — KHÔNG truy vấn DB/Redis trực tiếp trong Service

### ❌ VI PHẠM — Import Prisma/Redis trong service:
```typescript
// TRONG service.ts — SAI
import { PrismaService } from '...';
import { RedisRequestResponseService } from '...';

// Và gọi trực tiếp
const result = await this.prisma.stocks.findMany({...});
const data = await this.redis.sendRequest('channel', ...);
```

### ✅ ĐÚNG — Luôn dùng qua Repository layer:

**3A. Dữ liệu DB (MikroORM) → Thông qua UnitOfWork:**
```typescript
// Repository extends SqlEntityRepository
@Injectable()
export class MyRepository extends SqlEntityRepository<MyEntity> {
  async findByType(type: string): Promise<MyEntity[]> {
    return this.find({ type });
  }
}

// Service inject UnitOfWork, không inject Repository trực tiếp
constructor(private readonly unitOfWork: UnitOfWork) {}

const items = await this.unitOfWork.MyRepo.findByType('xxx');
```

**3B. Dữ liệu Redis (Pub/Sub) → Thông qua Redis Repository:**
```typescript
// Tạo file: src/infrastructure/domain/repositories/redis/<domain>-redis.repository.ts
@Injectable()
export class InventoryRedisRepository {
  constructor(private readonly redis: RedisRequestResponseService) {}

  async getPagedStock(params: { pageSize?: number; isLowStock?: boolean }) {
    return this.redis.sendRequest<unknown>('inventory_data_request', 'getInventory', params, 15000);
  }
}

// Service inject XxxRedisRepository
constructor(private readonly inventoryRedisRepo: InventoryRedisRepository) {}

// Sử dụng
const data = (await this.inventoryRedisRepo.getPagedStock({ pageSize: 100 })) as { items: RedisInventoryStockResponse[] };
```

---

## 4. Quy Tắc: Service — Chỉ chứa Business Logic

### Service được phép:
- Gọi methods từ Repository
- Gọi service khác (ngang hàng)
- Xử lý lỗi qua `funcHandlerAsync`
- Log via `this.logger`
- Orchestrate multi-step logic

### Service KHÔNG được phép:
- Import `PrismaService`, `PrismaClient`
- Import `RedisRequestResponseService`
- Khai báo `interface`, `type` trực tiếp
- Viết raw SQL/query

---

## 5. Quy Tắc: Loại Bỏ `any` và `unknown`

### ❌ SAI:
```typescript
function process(data: unknown) {
  const safe = data as { variants?: any[] }; // Ép kiểu mù
}
```

### ✅ ĐÚNG:
```typescript
// Khai báo interface rõ ràng trong DTO
function process(data: RestockLogPayload | null | undefined) {
  const variants = data?.variants ?? [];
}

// Khi Redis trả về, cast về interface đã khai báo
const response = (await this.redisRepo.getPagedStock({...})) as { items: RedisInventoryStockResponse[] };
```

### Quy tắc cast Redis response:
- `sendRequest<unknown>` là bình thường (wrapper không biết kiểu runtime)
- Sau khi nhận về, ÉP KIỂU ngay bằng interface từ `redis-internal.response.ts`
- **Không dùng `as any`** để lách qua type check

---

## 6. Quy Tắc: .NET Backend — Không Sửa DTO Gốc (Open/Closed Principle)

Các DTO gốc (`StockResponse.cs`, `BatchResponse.cs`, v.v.) thuộc sở hữu của team khác.

### ❌ SAI — Sửa trực tiếp vào DTO gốc:
```csharp
public record StockResponse {
    // ...existing fields...
    public VariantType Type { get; init; } // ← KHÔNG được thêm vào đây
}
```

### ✅ ĐÚNG — Tạo class kế thừa cho AI:
```csharp
// File: AiStockResponse.cs
public record AiStockResponse : StockResponse {
    public VariantType Type { get; init; }
    public int ReservedQuantity { get; init; }
}
```

Khi mapping trong Repository, dùng `new AiStockResponse { ... }` thay vì `new StockResponse { ... }`.

---

## 7. Quy Tắc: ESLint Config — Không Thay Đổi

File `eslint.config.mjs` đang dùng `__dirname` và `sourceType: 'commonjs'`.

**KHÔNG sửa** `tsconfigRootDir: __dirname` → `import.meta.dirname`. Project đang ổn định với cấu hình này.

---

## 8. Quy Tắc: i18n — Không Hardcode Chuỗi Thông Báo

Project đã cài `nestjs-i18n`. Tất cả chuỗi thông báo lỗi và response message phải qua i18n.

### ❌ SAI — Hardcode string:
```typescript
throw new BadRequestException('Conversation already exists');
return { error: 'Failed to fetch inventory stock from Redis' };
```

### ✅ ĐÚNG — Dùng i18n key:
```typescript
import { I18nService } from 'nestjs-i18n';

constructor(private readonly i18n: I18nService) {}

// Trong method
const message = this.i18n.t('errors.conversation.already_exists');
throw new BadRequestException(message);
```

Tệp ngôn ngữ lưu tại `src/i18n/<lang>/<domain>.json`.

---

## 9. Quy Tắc: System Prompt — Tập Trung vào Seed Data

### Nguyên tắc:
- **Admin Instruction Seed** (`admin-instruction-seed-data.ts`) là **nguồn sự thật duy nhất** cho hành vi AI mỗi domain.
- Mỗi domain chỉ có 1 instruction trong seed file, admin có thể thay đổi qua API.
- **Không hardcode system prompt** cho logic nghiệp vụ của từng domain bên ngoài seed file.

### Các loại prompt được giữ ở `system.prompt.ts` (hợp lệ):
| Prompt | Lý do giữ lại |
|---|---|
| `CONVERSATION_ANALYSIS_SYSTEM_PROMPT` | Prompt kỹ thuật nội bộ cho pipeline phân tích |
| `INTERNAL_NORMALIZATION_SYSTEM_PROMPT` | Dùng cho tool normalization |
| `SURVEY_ANALYSIS_SYSTEM_PROMPT` | Dùng cho pipeline survey |
| `PROMPT_OPTIMIZATION_SYSTEM_PROMPT` | Dùng cho optimization layer |

### Prompt KHÔNG được hardcode (phải vào seed):
- Hướng dẫn hành vi của AI với người dùng cuối (conversation, review, restock, ...)
- Vai trò chuyên gia của AI cho từng task
- Output format requirements cho business domain

### ❌ SAI — Có `STAFF_CONSULTATION_SYSTEM_PROMPT` vừa trong seed vừa trong `system.prompt.ts`:
```typescript
// Không nên có 2 nơi cho cùng 1 mục đích
export const STAFF_CONSULTATION_SYSTEM_PROMPT = `...`; // system.prompt.ts — DƯ THỪA
```

### ✅ ĐÚNG — Chỉ giữ 1 nơi (seed), service đọc qua `AdminInstructionService`:
```typescript
// Trong service
const systemPrompt = await this.adminInstructionService.getSystemPromptForDomain(INSTRUCTION_TYPE_STAFF_CONSULTATION);
```

---

## 10. Quy Tắc: Naming Conventions

| Loại file | Pattern | Ví dụ |
|---|---|---|
| Response DTO | `<name>.response.ts` | `inventory-stock.response.ts` |
| Request DTO | `<name>.request.ts` | `batch.request.ts` |
| Redis DTO | `redis-internal.response.ts` | (1 file duy nhất) |
| MikroORM Repo | `<name>.repository.ts` | `event-log.repository.ts` |
| Redis Repo | `<name>-redis.repository.ts` | `inventory-redis.repository.ts` |
| Service | `<name>.service.ts` | `inventory.service.ts` |
| AI Tool | `<name>.tool.ts` | `inventory.tool.ts` |
| Entity | `<name>.entity.ts` | `inventory-log.entity.ts` |
| Module | `<name>.module.ts` | `inventory.module.ts` |

---

## 11. Quy Tắc: File Cấu Trúc Module NestJS

Mỗi domain thường có cấu trúc:
```
<domain>/
├── <domain>.module.ts      # Module định nghĩa imports, providers, exports
├── <domain>.service.ts     # Business logic
└── (không có controller riêng nếu dùng chung ConversationController)
```

Khi thêm Redis Repository mới vào domain:
1. Tạo `repositories/redis/<domain>-redis.repository.ts`
2. Thêm vào `providers` và (nếu cần) `exports` trong module tương ứng
3. Inject vào service qua constructor

---

## 12. Luồng Thêm Tính Năng Mới

1. **Tạo DTO** trong `application/dtos/` trước
2. **Tạo hoặc cập nhật Repository** (MikroORM hoặc Redis)
3. **Thêm logic vào Service** — chỉ gọi repository, không query trực tiếp
4. **Cập nhật Controller** nếu cần endpoint mới
5. **Cập nhật Module** nếu có provider/export mới
6. **Chạy `npx eslint`** để kiểm tra linting trước khi commit

---

## Checklist Trước Khi Commit

- [ ] Không có `interface`/`type` trong service/tool
- [ ] Không có `PrismaClient` hay `RedisRequestResponseService` import trong service
- [ ] Không có `as any` để bypass type check
- [ ] Không có chuỗi hardcode nên dùng i18n
- [ ] Không có system prompt nghiệp vụ ngoài seed file
- [ ] Không sửa DTO gốc của người khác ở .NET (chỉ extend)
- [ ] `eslint.config.mjs` không thay đổi `__dirname`
- [ ] Chạy `pnpm run build` thành công, không còn lỗi lint/type check.
- [ ] Cập nhật `walkthrough.md` với bằng chứng hình ảnh (nếu là UI).
