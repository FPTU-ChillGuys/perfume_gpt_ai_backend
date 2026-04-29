# 🎯 Coding Conventions & Architecture — Perfume GPT AI Backend

> [!IMPORTANT]
> Đây là tài liệu quy chuẩn bắt buộc cho project `perfume_gpt_ai_backend`. Mọi đóng góp code mới hoặc refactor đều phải tuân thủ nghiêm ngặt các quy tắc dưới đây để đảm bảo tính nhất quán và hiệu suất của hệ thống AI.

---

## 🏛️ 1. Kiến Trúc Phân Tầng (Layered Architecture)

Hệ thống được tổ chức theo mô hình Layered Architecture để tách biệt rõ ràng các nhiệm vụ:

- **`src/api/controllers/`**: Chỉ tiếp nhận Request, gọi Service và trả về Response chuẩn. Không chứa business logic.
- **`src/application/`**:
    - `dtos/request/<domain>/`: Chứa các Request DTO riêng biệt cho từng hành động (ví dụ: `create-xxx.request.ts`, `update-xxx.request.ts`).
    - `dtos/response/<domain>/`: Chứa các Response DTO (ví dụ: `xxx.response.ts`).
    - `constant/`: Các hằng số toàn cục (Prompt types, Enums, v.v.).
- **`src/domain/entities/`**: Khai báo các MikroORM Entities (PostgreSQL).
- **`src/infrastructure/domain/`**:
    - `<domain>/service.ts`: Chứa **TẤT CẢ** Business Logic.
    - `repositories/`: Tương tác với Database (PostgreSQL via MikroORM).
    - `repositories/redis/`: Tương tác với Redis (Caching, temporary data).
- **`src/chatbot/tools/`**: Định nghĩa các Tool cho AI agent.

---

## 📦 2. DTO & Type Safety — Không dùng `any`

### ❌ KHÔNG ĐƯỢC:
- Định nghĩa `interface` hoặc `type` trực tiếp trong file Service hoặc Tool.
- Sử dụng `any` hoặc `as any` để bỏ qua kiểm tra kiểu.
- Sử dụng `unknown` mà không có bước validation (Zod hoặc Type Guard).

### ✅ QUY TẮC:
- Toàn bộ Model/Interface phải nằm trong `src/application/dtos/`.
- Phân tách rõ ràng giữa `request` và `response`.
- Dữ liệu trả về từ các service ngoại vi (Prisma SQL Server, Axios) phải được map sang DTO nội bộ ngay lập tức.
- **Quy tắc Mapping Tĩnh (Static Mapping)**:
    - Không sử dụng thư viện mapping bên thứ ba (như AutoMapper). 
    - Định nghĩa các static method trong class DTO để thực hiện chuyển đổi dữ liệu (ví dụ: `fromEntity(entity)`).
    - **Xử lý Nullability**: Phương thức `fromEntity` phải hỗ trợ kiểu trả về nullable: `static fromEntity(entity: T): TResponse | null`.
    - Kiểm tra thực thể đầu vào ngay lập tức: `if (!entity) return null;`.
    - Khi map các collection con (ví dụ: `messages`), sử dụng non-null assertion `!` nếu đã chắc chắn dữ liệu được populate hợp lệ (ví dụ: sau khi gọi `getItems()`).

---

## 💾 3. Repository Pattern — Tuyệt đối không Query trực tiếp

### ❌ VI PHẠM:
```typescript
// TRONG service.ts — SAI
@Injectable()
export class MyService {
  constructor(private readonly em: EntityManager) {}
  
  async getData() {
    return this.em.find(MyEntity, { status: 'active' }); // TRUY VẤN TRỰC TIẾP LÀ SAI
  }
}
```

### ✅ ĐÚNG:
- **Service chỉ inject và gọi- **Repository Layer**:
    - Mọi Repository phải kế thừa từ `BaseRepository<T>` nằm trong `src/infrastructure/domain/repositories/base/`.
    - `BaseRepository` cung cấp sẵn các hàm chuẩn: `add()`, `remove()` (soft delete), `flush()`, `getPaged()`, `exists()`.
    - Không được khai báo lại các hàm persistence cơ bản trong repository con trừ khi có logic đặc biệt.
- Đối với PostgreSQL: Service gọi Repo, Repo xử lý logic tầng MikroORM.
- Đối với SQL Server: Sử dụng **PrismaService** (chỉ đọc) và map sang DTO.

---

## 🤖 4. AI Prompt Management — Centralized in Database

### Nguyên tắc:
- **Admin Instruction Seed Data** là nguồn sự thật duy nhất cho hành vi AI của từng domain (Review, Order, Inventory, v.v.).
- **Không hard-code system prompt** nghiệp vụ bên trong code.
- Mọi thay đổi về "cách AI trả lời" phải được thực hiện thông qua cập nhật Seed file hoặc qua API của `AdminInstructionService`.

### Các prompt được phép ở dạng file hằng số:
- Các prompt mang tính kỹ thuật hạ tầng (Pipeline phân tích nội bộ, Normalization logic).

---

## 📏 5. Quy Tắc Đặt Tên (Naming)

| Loại | Pattern | Ví dụ | Mô tả |
|---|---|---|---|
| **Controller** | `*.controller.ts` | `conversation.controller.ts` | Chỉ tiếp nhận request, gọi service, trả về response. Không chứa business logic. |
| **Service** | `*.service.ts` | `product-search.service.ts` | Chứa **TẤT CẢ** business logic. Method không vượt quá 50 dòng. |
| **Repository** | `*.repository.ts` | `event-log.repository.ts` | Tương tác với DB, kế thừa `BaseRepository<T>`. |
| **Helper** | `*.helper.ts` | `ai-analysis.helper.ts` | Injectable, chứa logic hỗ trợ cho Service (có thể inject dependencies). Đặt trong `helpers/` của domain. |
| **Processor** | `*.processor.ts` | `survey.processor.ts` | **DÀNH RIÊNG CHO BULLMQ QUEUE** — xử lý background jobs. Không dùng cho business logic thông thường. |
| **DTO Response** | `*.response.ts` | `product-detail.response.ts` | Định nghĩa response shape + static `fromEntity()`. |
| **DTO Request** | `*.request.ts` | `search-query.request.ts` | Định nghĩa request shape + validation rules. |
| **Entity** | `*.entity.ts` | `conversation.entity.ts` | MikroORM entity. |
| **Module** | `*.module.ts` | `inventory.module.ts` | NestJS module. |

### ⚠️ Phân biệt Helper vs Processor:
- **Helper** (`*.helper.ts`): Logic hỗ trợ, có thể inject dependencies, được gọi trực tiếp từ Service.
- **Processor** (`*.processor.ts`): **Chỉ dùng cho BullMQ Queue** — xử lý background jobs, không được dùng cho request/response transformation.

### ⚠️ Phân biệt Helper vs Utils:
- **Helper** (`*.helper.ts`): Injectable class, có thể cần dependencies (ConfigService, Logger, v.v.).
- **Utils** (`*.util.ts`): Pure static functions, không có dependencies, không cần inject. Ví dụ: `toon-encoder.util.ts`.

---

## 🔗 6. Path Aliases — Sử dụng `src/*`

Bắt buộc sử dụng path alias `src/*` cho tất cả các import nội bộ thay vì dùng relative path (`../`). Điều này giúp tránh lỗi đường dẫn khi di chuyển file hoặc thay đổi cấu trúc thư mục.

- **❌ KHÔNG DÙNG**: `import { ... } from '../../constant/xxx';`
- **✅ NÊN DÙNG**: `import { ... } from 'src/application/constant/xxx';`

---

## 🚀 7. Checklist Trước Khi Commit

- [ ] Toàn bộ interface đã được extract ra thư mục `dtos`.
- [ ] Không còn sự hiện diện của `any` trong code mới.
- [ ] Logic truy vấn DB đã được chuyển vào Repository tầng Infrastructure.
- [ ] Các thông báo lỗi đã được bọc bởi `i18n` (nếu có yêu cầu đa ngôn ngữ).
- [ ] Chạy `pnpm run lint` và `pnpm run format` để đảm bảo code sạch.

---

## 🎮 8. Controller Rules

- Khi cập nhật controller, **chỉ loại bỏ** các API thừa/deprecated.
- **Không tự ý thêm** endpoint mới vào controller trừ khi được yêu cầu rõ ràng.
- Business logic mới → tích hợp vào service/tool/instruction hiện có thay vì tạo API riêng.

---

*Tài liệu này sẽ được cập nhật liên tục khi cấu trúc hệ thống thay đổi.*
