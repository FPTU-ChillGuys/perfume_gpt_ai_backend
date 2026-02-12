# Perfume GPT AI Backend

> AI Chatbot backend cho hệ thống PerfumeGPT - được xây dựng bằng NestJS, MikroORM và PostgreSQL.

## Mục lục

- [Yêu cầu hệ thống](#yêu-cầu-hệ-thống)
- [Cài đặt từng bước](#cài-đặt-từng-bước)
  - [Bước 1: Clone repository & cài đặt dependencies](#bước-1-clone-repository--cài-đặt-dependencies)
  - [Bước 2: Cài đặt PostgreSQL (Docker)](#bước-2-cài-đặt-postgresql-docker)
  - [Bước 3: Cấu hình file môi trường (.env)](#bước-3-cấu-hình-file-môi-trường-env)
  - [Bước 4: Cấu hình kết nối database (host-config.mjs)](#bước-4-cấu-hình-kết-nối-database-host-configmjs)
  - [Bước 5: Cấu hình RSA Keys (public_key.pem)](#bước-5-cấu-hình-rsa-keys-public_keypem)
  - [Bước 6: Kiểm tra kết nối database](#bước-6-kiểm-tra-kết-nối-database)
  - [Bước 7: Chạy migration](#bước-7-chạy-migration)
  - [Bước 8: Seed dữ liệu mặc định](#bước-8-seed-dữ-liệu-mặc-định)
  - [Bước 9: Chạy project](#bước-9-chạy-project)
- [Admin Instructions (Chỉ thị AI)](#admin-instructions-chỉ-thị-ai)
- [Cài đặt Backend chính (.NET)](#cài-đặt-backend-chính-net)
- [Tổng quan kiến trúc](#tổng-quan-kiến-trúc)
- [Chi tiết các Controller](#chi-tiết-các-controller)
  - [1. AppController](#1-appcontroller)
  - [2. AdminInstructionController](#2-admininstructioncontroller)
  - [3. AIAcceptanceController](#3-aiacceptancecontroller)
  - [4. OrderController](#4-ordercontroller)
  - [5. InventoryController](#5-inventorycontroller)
  - [6. ConversationController](#6-conversationcontroller)
  - [7. ProductController](#7-productcontroller)
  - [8. ProfileController](#8-profilecontroller)
  - [9. ReviewController](#9-reviewcontroller)
  - [10. QuizController](#10-quizcontroller)
  - [11. LogController](#11-logcontroller)
  - [12. TrendController](#12-trendcontroller)
  - [13. RecommendationController](#13-recommendationcontroller)
  - [14. AIController](#14-aicontroller)
  - [Ghi chú chung về Controller](#ghi-chú-chung-về-controller)

---

## Yêu cầu hệ thống

| Tool          | Phiên bản tối thiểu | Ghi chú                          |
| ------------- | -------------------- | -------------------------------- |
| **Node.js**   | >= 18                |                                  |
| **pnpm**      | >= 8                 | **Sử dụng pnpm, KHÔNG dùng npm** |
| **Docker**    | Latest               | Để chạy PostgreSQL               |
| **PostgreSQL**| >= 14                | Chạy qua Docker                  |
| **.NET SDK**  | >= 8.0               | Cho backend chính (perfume-gpt-backend) |

---

## Cài đặt từng bước

### Bước 1: Clone repository & cài đặt dependencies

```bash
git clone https://github.com/FPTU-ChillGuys/perfume_gpt_ai_backend.git
cd perfume_gpt_ai_backend
```

> **Lưu ý:** Sử dụng `pnpm` để install, **KHÔNG** dùng `npm`.

```bash
pnpm install
```

---

### Bước 2: Cài đặt PostgreSQL (Docker)

Cài đặt [Docker Desktop](https://www.docker.com/products/docker-desktop/) nếu chưa có, sau đó chạy PostgreSQL container:

```bash
docker run --name perfume-gpt-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=your_password \
  -e POSTGRES_DB=perfume_gpt_ai \
  -p 5432:5432 \
  -d postgres:16
```

> Thay `your_password` bằng mật khẩu bạn muốn đặt.

Kiểm tra container đã chạy:

```bash
docker ps
```

---

### Bước 3: Cấu hình file môi trường (.env)

Tạo file `.env` tại thư mục gốc của project với nội dung sau:

```env
# Server
PORT=3000

# .NET Backend URL (perfume-gpt-backend)
BASE_URL=https://localhost:7011/api

# JWT Configuration (phải trùng với cấu hình bên perfume-gpt-backend)
JWT_ISSUER=PerfumeGPT
JWT_AUDIENCE=PerfumeGPT

# OpenAI API Key
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
```

> **Lưu ý:**
> - `BASE_URL` trỏ tới backend .NET (`perfume-gpt-backend`). Mặc định là `https://localhost:7011/api`.
> - `JWT_ISSUER` và `JWT_AUDIENCE` phải **trùng khớp** với cấu hình JWT bên repo `perfume-gpt-backend`.
> - `OPENAI_API_KEY` là API key từ OpenAI để sử dụng các tính năng AI.

---

### Bước 4: Cấu hình kết nối database (host-config.mjs)

Copy file `host-config.mjs.example` thành `host-config.mjs` và chỉnh sửa thông tin kết nối PostgreSQL:

```bash
cp host-config.mjs.example host-config.mjs
```

Mở file `host-config.mjs` và sửa `user` & `password` cho khớp với PostgreSQL container đã tạo ở Bước 2:

```js
export const host_config = {
  host: 'localhost',    // Mặc định localhost, không cần sửa
  port: 5432,           // Mặc định 5432, không cần sửa
  user: 'postgres',     // Sửa thành user PostgreSQL của bạn
  password: 'your_password'  // Sửa thành password PostgreSQL của bạn
};
```

> **Lưu ý:** Thông thường PostgreSQL mặc định `host` là `localhost` và `port` là `5432`, nên bạn **chỉ cần sửa `user` và `password`**.

---

### Bước 5: Cấu hình RSA Keys (public_key.pem)

Project này sử dụng xác thực JWT bằng RSA (RS256). Bạn cần có cặp key RSA (`private_key.pem` và `public_key.pem`).

#### Đối với `perfume_gpt_ai_backend` (project này):

Chỉ cần **copy file `public_key.pem`** vào **thư mục gốc** của project:

```
perfume_gpt_ai_backend/
├── public_key.pem       <-- Copy file vào đây
├── host-config.mjs
├── package.json
├── ...
```

> Project này chỉ cần `public_key.pem` để **verify** JWT token (không cần private key).

#### Đối với `perfume-gpt-backend` (backend .NET):

Cần cấu hình **cả 2 key** trong file `.env` hoặc `appsettings.json`:

| Key trong .env       | File PEM            | Mô tả                           |
| -------------------- | ------------------- | -------------------------------- |
| `Jwt__Key`           | `private_key.pem`   | Mở file, copy toàn bộ nội dung  |
| `JWT_PUBLIC_KEY`     | `public_key.pem`    | Mở file, copy toàn bộ nội dung  |

Cách thực hiện:
1. Mở file `private_key.pem` → Copy toàn bộ nội dung → Paste vào giá trị `Jwt__Key` trong `.env` của backend .NET
2. Mở file `public_key.pem` → Copy toàn bộ nội dung → Paste vào giá trị `JWT_PUBLIC_KEY` trong `.env` của backend .NET

> **Nếu chưa có cặp key RSA**, có thể tạo bằng OpenSSL:
> ```bash
> # Tạo private key
> openssl genpkey -algorithm RSA -out private_key.pem -pkeyopt rsa_keygen_bits:2048
>
> # Tạo public key từ private key
> openssl rsa -pubout -in private_key.pem -out public_key.pem
> ```

---

### Bước 6: Kiểm tra kết nối database

Chạy lệnh sau để kiểm tra kết nối tới PostgreSQL:

```bash
npx mikro-orm debug
```

Nếu kết nối thành công, bạn sẽ thấy output tương tự:

```
- searched for config name: default
- configuration found
- driver dependencies:
  - knex 3.1.0
  - pg 8.17.2
- database connection successful     ✅
- will use 'entities' array (contains X references and 0 paths)
```

> **Quan trọng:** Nếu hiện `database connection successful` thì đã kết nối OK. Nếu bị lỗi, hãy kiểm tra lại thông tin `user`, `password` trong `host-config.mjs` và đảm bảo PostgreSQL container đang chạy.

---

### Bước 7: Chạy migration

Sau khi kết nối database thành công, chạy migration để tạo các bảng trong database:

```bash
npx mikro-orm migration:up
```

> **Lưu ý:** Migration cũng sẽ tự động chạy mỗi khi khởi động app (ở bước 9).

---

### Bước 8: Seed dữ liệu mặc định

Project cần dữ liệu **Admin Instructions** (chỉ thị cho AI) để các tính năng phân tích hoạt động tốt. Có **3 cách** để nạp dữ liệu:

#### Cách 1: Chạy lệnh seed (khuyến nghị)

```bash
pnpm run seed
```

Lệnh này sẽ tự động:
- Kết nối database
- Chạy migration nếu cần
- Thêm dữ liệu mặc định cho 7 domain AI (review, order, inventory, trend, recommendation, log, conversation)
- **Idempotent**: chạy nhiều lần không bị trùng - chỉ thêm cho domain chưa có data

#### Cách 2: Để app tự seed khi khởi động

Khi chạy `pnpm run start:dev`, app sẽ tự động seed nếu phát hiện domain chưa có instruction nào. Không cần làm gì thêm.

#### Cách 3: Import SQL trực tiếp (cho DBA hoặc CI/CD)

Nếu muốn import bằng SQL:

```bash
psql -U postgres -d perfume_gpt_ai -f scripts/seed-admin-instructions.sql
```

Hoặc mở file `scripts/seed-admin-instructions.sql` và chạy trong bất kỳ SQL client nào (pgAdmin, DBeaver, DataGrip, ...).

---

### Bước 9: Chạy project

```bash
# Development (watch mode - tự động reload khi thay đổi code)
pnpm run start:dev

# Hoặc chạy bình thường
pnpm run start

# Production mode
pnpm run start:prod
```

Server sẽ chạy tại: **http://localhost:3000**

API Reference (Scalar): **http://localhost:3000/reference**

---

## Admin Instructions (Chỉ thị AI)

Hệ thống **Admin Instructions** cho phép admin quản lý các chỉ thị (system prompt) cho AI thông qua API, thay vì hard-code trong source code.

### Domain types

| Domain           | Mô tả                                      | Endpoint AI sử dụng                     |
| ---------------- | ------------------------------------------- | ---------------------------------------- |
| `review`         | Hướng dẫn tóm tắt đánh giá sản phẩm        | `GET /reviews/summary/*`                 |
| `order`          | Hướng dẫn phân tích đơn hàng                | `GET /orders/summary/ai*`                |
| `inventory`      | Hướng dẫn báo cáo tồn kho                   | `GET /inventory/report/ai*`              |
| `trend`          | Hướng dẫn dự đoán xu hướng                  | `POST /trends/summary*`                  |
| `recommendation` | Hướng dẫn gợi ý sản phẩm                    | `POST /recommendation/*`                 |
| `log`            | Hướng dẫn tóm tắt log hoạt động             | `GET /logs/summarize*`                   |
| `conversation`   | Hướng dẫn chatbot tư vấn                    | `POST /conversation/*`                   |

### Quản lý qua API (cần role admin)

| Method   | Endpoint                            | Mô tả                              |
| -------- | ----------------------------------- | ----------------------------------- |
| `GET`    | `/admin/instructions`               | Lấy tất cả instructions             |
| `GET`    | `/admin/instructions/type/:type`    | Lấy theo domain type                |
| `GET`    | `/admin/instructions/combined/:type`| Gộp thành prompt theo type          |
| `POST`   | `/admin/instructions`               | Tạo instruction mới                 |
| `PUT`    | `/admin/instructions/:id`           | Cập nhật instruction                 |
| `DELETE` | `/admin/instructions/:id`           | Xóa instruction                      |

### Cách hoạt động

```
Admin tạo instruction (instructionType = "review")
        ↓
User gọi GET /reviews/summary/:variantId
        ↓
Controller fetch admin instructions cho domain "review"
        ↓
Instructions được inject làm additionalSystemPrompt cho AI
        ↓
AI trả về kết quả theo hướng dẫn của admin
```

> **Lưu ý:** Nếu không có instruction nào cho một domain, AI vẫn hoạt động bình thường với system prompt mặc định.

### File liên quan

```
src/infrastructure/seed/
├── admin-instruction-seed-data.ts   # Dữ liệu mặc định
├── admin-instruction.seeder.ts      # Logic seed (idempotent)
└── run-seed.ts                      # Standalone runner (pnpm run seed)

scripts/
└── seed-admin-instructions.sql      # SQL import thủ công

src/application/constant/prompts/
└── admin-instruction-types.ts       # Hằng số domain types
```

---

## Cài đặt Backend chính (.NET)

Project AI Backend này gọi API tới backend chính [perfume-gpt-backend](https://github.com/FPTU-ChillGuys/perfume-gpt-backend) (xây dựng bằng .NET) để sử dụng các chức năng như: **Product, Order, Inventory, Review**, v.v.

> **Bắt buộc phải chạy backend .NET song song** với project này để các tính năng hoạt động đầy đủ.

### Các bước cài đặt perfume-gpt-backend:

1. **Clone repository:**
   ```bash
   git clone https://github.com/FPTU-ChillGuys/perfume-gpt-backend.git
   cd perfume-gpt-backend
   ```

2. **Cấu hình `.env`:**
   Copy file `.env.example` thành `.env` và điền các thông tin cần thiết:
   ```bash
   cp .env.example .env
   ```
   
   Trong file `.env`, cấu hình các giá trị quan trọng:
   ```env
   # Database (SQL Server)
   ConnectionStrings__DefaultConnection=Server=localhost;Database=PerfumeGPT;...
   
   # JWT - RSA Keys
   Jwt__Key=<nội dung private_key.pem>
   JWT_PUBLIC_KEY=<nội dung public_key.pem>
   Jwt__Issuer=PerfumeGPT
   Jwt__Audience=PerfumeGPT
   
   # CORS - AI Backend URL
   Back-end__aiUrl=http://localhost:3000
   ```

3. **Chạy project:**
   ```bash
   dotnet run --project PerfumeGPT.API
   ```
   
   Backend .NET sẽ chạy tại: **https://localhost:7011**
   
   OpenAPI docs: **https://localhost:7011/openapi/v1.json**

---

## Tổng quan kiến trúc

```
┌─────────────────────┐     API calls      ┌──────────────────────────┐
│                     │ ──────────────────> │                          │
│  perfume_gpt_ai_    │                     │   perfume-gpt-backend    │
│  backend            │                     │   (.NET)                 │
│  (NestJS + AI)      │ <────────────────── │                          │
│  Port: 3000         │    JSON responses   │   Port: 7011             │
│                     │                     │                          │
│  - AI Chatbot       │                     │   - Products API         │
│  - Recommendations  │                     │   - Orders API           │
│  - Quiz             │                     │   - Inventory API        │
│  - Conversations    │                     │   - Reviews API          │
│  - Trend Analysis   │                     │   - Auth (JWT RS256)     │
│                     │                     │                          │
└────────┬────────────┘                     └────────┬─────────────────┘
         │                                           │
         │ MikroORM                                  │ EF Core
         ▼                                           ▼
   ┌───────────┐                              ┌───────────┐
   │PostgreSQL │                              │SQL Server │
   │(AI Data)  │                              │(Main Data)│
   └───────────┘                              └───────────┘
```

---

## Chi tiết các Controller

Hệ thống gồm **14 controller** chia thành 3 nhóm theo quyền truy cập:

### Bảng tổng quan

| Controller | Route prefix | Auth | Role | Số endpoint |
|---|---|---|---|---|
| [AppController](#1-appcontroller) | `/` | 🔒 JWT (global guard) | — | 1 |
| [AdminInstructionController](#2-admininstructioncontroller) | `/admin/instructions` | 🔒 JWT | `admin` | 7 |
| [AIAcceptanceController](#3-aiacceptancecontroller) | `/ai-acceptance` | 🔒 JWT | — | 5 |
| [OrderController](#4-ordercontroller) | `/orders` | 🔒 JWT | — | 4 |
| [InventoryController](#5-inventorycontroller) | `/inventory` | ⚠️ Public (xem lưu ý) | `admin` (không hoạt động) | 5 |
| [ConversationController](#6-conversationcontroller) | `/conversation` | Hỗn hợp | `admin` (một số endpoint) | 13 |
| [ProductController](#7-productcontroller) | `/products` | 🌐 Public | — | 2 |
| [ProfileController](#8-profilecontroller) | `/profile` | 🌐 Public | — | 2 |
| [ReviewController](#9-reviewcontroller) | `/reviews` | 🌐 Public | — | 4 |
| [QuizController](#10-quizcontroller) | `/quizzes` | 🌐 Public | — | 6 |
| [LogController](#11-logcontroller) | `/logs` | 🌐 Public | — | 6 (+2 cron) |
| [TrendController](#12-trendcontroller) | `/trends` | 🌐 Public | — | 2 |
| [RecommendationController](#13-recommendationcontroller) | `/recommendation` | 🌐 Public | — | 5 |
| [AIController](#14-aicontroller) | `/ai` | 🌐 Public | — | 1 |

> **Ký hiệu:**
> - 🔒 = Yêu cầu Bearer JWT token
> - 🌐 = Truy cập tự do, không cần token
> - ⚠️ = Có vấn đề cần lưu ý

---

### 1. AppController

**Route:** `/` | **Auth:** 🔒 JWT (global guard mặc định) | **Tag Swagger:** `App`

Health check endpoint, kiểm tra server có đang hoạt động hay không.

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `GET` | `/` | Health check - trả về chuỗi xác nhận server đang chạy | 🔒 JWT |

**Cách sử dụng:**
```bash
curl http://localhost:3000/
```

> **Lưu ý:** Endpoint này không có `@Public()` nên mặc định bị global AuthGuard bảo vệ. Cần truyền Bearer token trong header để truy cập.

---

### 2. AdminInstructionController

**Route:** `/admin/instructions` | **Auth:** 🔒 JWT + Role `admin` | **Tag Swagger:** `Admin Instructions`

Quản lý CRUD các chỉ thị (instruction) dùng để điều khiển hành vi AI cho từng domain (review, order, inventory, trend, recommendation, log, conversation).

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `GET` | `/admin/instructions` | Lấy tất cả chỉ thị admin | 🔒 admin |
| `GET` | `/admin/instructions/:id` | Lấy chỉ thị theo ID | 🔒 admin |
| `GET` | `/admin/instructions/type/:type` | Lấy chỉ thị theo loại (system / prompt / rule) | 🔒 admin |
| `GET` | `/admin/instructions/combined/:type` | Gộp tất cả chỉ thị theo type thành một chuỗi prompt cho AI | 🔒 admin |
| `POST` | `/admin/instructions` | Tạo chỉ thị mới | 🔒 admin |
| `PUT` | `/admin/instructions/:id` | Cập nhật chỉ thị | 🔒 admin |
| `DELETE` | `/admin/instructions/:id` | Xóa chỉ thị | 🔒 admin |

**Cách sử dụng:**
```bash
# Lấy tất cả
curl -H "Authorization: Bearer <admin_token>" http://localhost:3000/admin/instructions

# Tạo mới
curl -X POST -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"instructionType": "review", "content": "Tóm tắt ngắn gọn", "priority": 1}' \
  http://localhost:3000/admin/instructions
```

> **Lưu ý:**
> - Tất cả endpoint đều yêu cầu role `admin`. Token của user thường sẽ bị từ chối (403 Forbidden).
> - `instructionType` phải là một trong: `review`, `order`, `inventory`, `trend`, `recommendation`, `log`, `conversation`.
> - Nếu không có instruction nào cho một domain, AI vẫn hoạt động bình thường với system prompt mặc định.

---

### 3. AIAcceptanceController

**Route:** `/ai-acceptance` | **Auth:** 🔒 JWT | **Tag Swagger:** `AI Acceptance`

Quản lý trạng thái chấp nhận/từ chối gợi ý AI của người dùng. Dùng để theo dõi tỷ lệ người dùng tin tưởng kết quả AI.

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `POST` | `/ai-acceptance/:id?status=true/false` | Cập nhật trạng thái chấp nhận AI theo ID bản ghi | 🔒 JWT |
| `GET` | `/ai-acceptance/status/:userId` | Lấy trạng thái chấp nhận AI của user | 🔒 JWT |
| `GET` | `/ai-acceptance/rate?isAccepted=true/false` | Lấy tỷ lệ chấp nhận/từ chối AI toàn hệ thống | 🔒 JWT |
| `GET` | `/ai-acceptance/rate/:userId` | Lấy tỷ lệ chấp nhận AI theo user | 🔒 JWT |
| `POST` | `/ai-acceptance/record/:userId?isAccepted=true/false` | Tạo bản ghi chấp nhận AI mới | 🔒 JWT |

**Cách sử dụng:**
```bash
# Xem trạng thái chấp nhận AI của user
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/ai-acceptance/status/<userId>

# Tạo bản ghi mới
curl -X POST -H "Authorization: Bearer <token>" \
  http://localhost:3000/ai-acceptance/record/<userId>?isAccepted=true
```

> **Lưu ý:**
> - Query param `status` và `isAccepted` nhận giá trị string `"true"` hoặc `"false"`, sẽ được parse thành boolean.
> - Endpoint `POST record/:userId` có logic đảo ngược: truyền `isAccepted=false` → lưu `true` (và ngược lại). Cần kiểm tra lại logic này nếu cần chính xác.

---

### 4. OrderController

**Route:** `/orders` | **Auth:** 🔒 JWT | **Tag Swagger:** `Orders`

Quản lý đơn hàng — lấy danh sách đơn hàng từ backend .NET và tạo báo cáo phân tích bằng AI.

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `GET` | `/orders` | Lấy danh sách tất cả đơn hàng | 🔒 JWT |
| `GET` | `/orders/user/:userId` | Lấy đơn hàng theo userId | 🔒 JWT |
| `GET` | `/orders/summary/ai?userId=` | Tạo báo cáo tóm tắt đơn hàng bằng AI (text) | 🔒 JWT |
| `GET` | `/orders/summary/ai/structured?userId=` | Tạo báo cáo AI có cấu trúc (JSON + metadata) | 🔒 JWT |

**Cách sử dụng:**
```bash
# Lấy tất cả đơn hàng
curl -H "Authorization: Bearer <token>" http://localhost:3000/orders

# Báo cáo AI theo user
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/orders/summary/ai?userId=<userId>"
```

> **Lưu ý:**
> - ⚠️ **Bug trong source code:** `OrderService.getOrderReportFromGetOrderDetailsWithOrdersByUserId` truy cập `orders.data` (undefined) thay vì `orders.payload`, khiến endpoint `/summary/ai` và `/summary/ai/structured` luôn trả về `success: false` hoặc insufficient data message.
> - Cần backend .NET đang chạy để lấy dữ liệu đơn hàng. Bearer token phải hợp lệ từ hệ thống .NET.
> - Endpoint `/structured` trả thêm metadata: `processingTimeMs`, `userId`, `generatedAt`.

---

### 5. InventoryController

**Route:** `/inventory` | **Auth:** ⚠️ Xem lưu ý | **Tag Swagger:** `Inventory`

Quản lý tồn kho — lấy stock, batch và tạo báo cáo AI phân tích tồn kho.

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `GET` | `/inventory/stock` | Lấy thông tin tồn kho (phân trang) | ⚠️ Public |
| `GET` | `/inventory/batches` | Lấy danh sách batch (phân trang) | ⚠️ Public |
| `GET` | `/inventory/report` | Lấy báo cáo tồn kho (text thô) | ⚠️ Public |
| `GET` | `/inventory/report/ai` | Tạo báo cáo tồn kho bằng AI (text) | ⚠️ Public |
| `GET` | `/inventory/report/ai/structured` | Tạo báo cáo tồn kho AI có cấu trúc (JSON + metadata) | ⚠️ Public |

**Cách sử dụng:**
```bash
# Lấy stock
curl http://localhost:3000/inventory/stock

# Báo cáo AI
curl http://localhost:3000/inventory/report/ai
```

> **⚠️ Lưu ý quan trọng (Bug):**
> - Controller có `@Public()` ở **class-level** và `@Role('admin')` cũng ở **class-level**. Vì `@Public()` khiến AuthGuard skip hoàn toàn, `@Role('admin')` **không có tác dụng**.
> - Kết quả: **Tất cả endpoint đều truy cập tự do** mà không cần token hay role admin.
> - **Cách sửa:** Bỏ `@Public()` ở class-level, chỉ giữ `@Role('admin')`, hoặc đặt `@Public()` / `@Role('admin')` trên từng method cụ thể.
> - Dữ liệu stock/batch được lấy từ backend .NET qua Bearer token trong header.

---

### 6. ConversationController

**Route:** `/conversation` | **Auth:** Hỗn hợp | **Tag Swagger:** `Conversation`

Controller phức tạp nhất — quản lý chatbot AI tư vấn nước hoa. Gồm 4 phiên bản chat (V1–V4), 4 phiên bản test (V1–V4), 2 endpoint test bảo vệ bởi admin, và CRUD conversation.

#### Endpoint CRUD (Public)

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `GET` | `/conversation` | Lấy tất cả cuộc hội thoại | 🌐 Public |
| `GET` | `/conversation?id=` | Lấy cuộc hội thoại theo ID | 🌐 Public |
| `GET` | `/conversation/list/paged` | Lấy danh sách hội thoại có phân trang | 🌐 Public |

#### Endpoint Chat (Public, hỗ trợ JWT tùy chọn)

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `POST` | `/conversation/chat/v1` | Chat V1 — dùng log tóm tắt | 🌐 Public (JWT tùy chọn) |
| `POST` | `/conversation/chat/v2` | Chat V2 — dùng log chi tiết (chậm hơn, đầy đủ hơn) | 🌐 Public (JWT tùy chọn) |
| `POST` | `/conversation/chat/v3` | Chat V3 — cải thiện V1, dùng common helper | 🌐 Public (JWT tùy chọn) |
| `POST` | `/conversation/chat/v4` | Chat V4 — cải thiện V2, dùng common helper | 🌐 Public (JWT tùy chọn) |

#### Endpoint Test (Public, hỗ trợ JWT tùy chọn)

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `POST` | `/conversation/test/v1?userId=&prompt=` | Test V1 — trả về text thay vì conversation | 🌐 Public (JWT tùy chọn) |
| `POST` | `/conversation/test/v2?userId=&prompt=` | Test V2 — log chi tiết | 🌐 Public (JWT tùy chọn) |
| `POST` | `/conversation/test/v3?userId=&prompt=` | Test V3 — common helper + log tóm tắt | 🌐 Public (JWT tùy chọn) |
| `POST` | `/conversation/test/v4?userId=&prompt=` | Test V4 — common helper + log chi tiết | 🌐 Public (JWT tùy chọn) |

#### Endpoint Guarded Test (Admin only)

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `POST` | `/conversation/test/guarded/v1?userId=&prompt=` | Test V1 dành riêng cho admin | 🔒 admin |
| `POST` | `/conversation/test/guarded/v2?userId=&prompt=` | Test V2 dành riêng cho admin | 🔒 admin |

**Cách sử dụng:**
```bash
# Chat V3 (khuyến nghị) — không cần token (guest)
curl -X POST -H "Content-Type: application/json" \
  -d '{"userId":"<userId>","messages":[{"id":"1","role":"user","content":"Gợi ý nước hoa cho mùa hè","parts":[{"type":"text","text":"Gợi ý nước hoa cho mùa hè"}]}]}' \
  http://localhost:3000/conversation/chat/v3

# Chat V3 — có token (lấy thêm profile + order)
curl -X POST -H "Content-Type: application/json" \
  -H "Authorization: Bearer <user_token>" \
  -d '{"userId":"<userId>","messages":[...]}' \
  http://localhost:3000/conversation/chat/v3

# Test nhanh
curl -X POST "http://localhost:3000/conversation/test/v3?userId=<userId>&prompt=Gợi ý nước hoa"
```

> **Lưu ý:**
> - **V1/V3** dùng log tóm tắt (nhanh, phụ thuộc vào chất lượng tóm tắt). **V2/V4** dùng log chi tiết (chậm hơn, đầy đủ hơn).
> - **V3/V4** là phiên bản cải thiện của V1/V2, dùng `buildCombinedPromptV1/V2` helper, giảm code trùng lặp. **Khuyến nghị sử dụng V3/V4.**
> - Nếu có **Bearer token** → AI lấy thêm profile + order history của user. Nếu không có token (guest) → chỉ dùng user log từ database.
> - **Guarded test endpoint** yêu cầu admin token. Lưu ý: admin token KHÔNG decode được profile user → profile sẽ trống.
> - Conversation được tự động lưu vào DB (tạo mới hoặc cập nhật nếu đã tồn tại).
> - Body request cần tuân theo format `ConversationRequestDto` với `messages` là mảng `MessageRequestDto`.

---

### 7. ProductController

**Route:** `/products` | **Auth:** 🌐 Public | **Tag Swagger:** `Products`

Lấy danh sách sản phẩm và tìm kiếm sản phẩm bằng semantic search từ backend .NET.

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `GET` | `/products` | Lấy danh sách sản phẩm (phân trang, sắp xếp) | 🌐 Public |
| `GET` | `/products/search?searchText=` | Tìm kiếm sản phẩm bằng semantic search | 🌐 Public |

**Cách sử dụng:**
```bash
# Lấy danh sách sản phẩm
curl "http://localhost:3000/products?pageIndex=1&pageSize=10"

# Tìm kiếm
curl "http://localhost:3000/products/search?searchText=nước hoa mùi hoa hồng"
```

> **Lưu ý:**
> - Dữ liệu được proxy từ backend .NET. Cần backend .NET đang chạy.
> - Hỗ trợ phân trang qua `PagedAndSortedRequest` (pageIndex, pageSize, sorting).

---

### 8. ProfileController

**Route:** `/profile` | **Auth:** 🌐 Public | **Tag Swagger:** `Profile`

Lấy thông tin profile của người dùng hiện tại từ backend .NET thông qua Bearer token (nếu có).

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `GET` | `/profile/me` | Lấy thông tin profile từ token | 🌐 Public (JWT tùy chọn) |
| `GET` | `/profile/report` | Tạo báo cáo profile dưới dạng text | 🌐 Public (JWT tùy chọn) |

**Cách sử dụng:**
```bash
# Lấy profile (cần truyền token trong header để có dữ liệu)
curl -H "Authorization: Bearer <user_token>" http://localhost:3000/profile/me
```

> **Lưu ý:**
> - Mặc dù `@Public()`, endpoint vẫn đọc Bearer token từ header (nếu có) để gọi API `.NET` lấy profile.
> - Nếu không truyền token hoặc token invalid → service trả về lỗi nhưng không bị AuthGuard chặn.

---

### 9. ReviewController

**Route:** `/reviews` | **Auth:** 🌐 Public | **Tag Swagger:** `Reviews`

Lấy danh sách đánh giá sản phẩm và tóm tắt bằng AI theo variant hoặc toàn bộ.

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `GET` | `/reviews` | Lấy danh sách đánh giá (phân trang) | 🌐 Public |
| `GET` | `/reviews/summary/:variantId` | Tóm tắt đánh giá bằng AI theo variant ID | 🌐 Public |
| `GET` | `/reviews/summary/all` | Tóm tắt đánh giá toàn bộ bằng AI | 🌐 Public |
| `GET` | `/reviews/summary/structured/:variantId` | Tóm tắt AI có cấu trúc (JSON + metadata) | 🌐 Public |

**Cách sử dụng:**
```bash
# Lấy danh sách
curl "http://localhost:3000/reviews?pageIndex=1&pageSize=10"

# Tóm tắt AI theo variant
curl http://localhost:3000/reviews/summary/<variantId>
```

> **Lưu ý:**
> - Dữ liệu review được lấy từ backend .NET.
> - Nếu không có review nào cho variant → trả về insufficient data message thay vì gọi AI (tiết kiệm token).
> - Endpoint `/summary/all` không có tham số route nhưng có thể xung đột route với `/summary/:variantId` khi `all` được parse thành variantId. Cần test kỹ thứ tự khai báo route.
> - Endpoint `/structured` trả thêm: `reviewCount`, `processingTimeMs`, `generatedAt`.
> - AI sử dụng Admin Instructions domain `review` (nếu có) để tùy chỉnh hành vi tóm tắt.

---

### 10. QuizController

**Route:** `/quizzes` | **Auth:** 🌐 Public | **Tag Swagger:** `Quizzes`

Quản lý câu hỏi quiz tìm hiểu sở thích nước hoa và nhận gợi ý từ AI dựa trên câu trả lời.

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `GET` | `/quizzes/questions` | Lấy danh sách câu hỏi quiz | 🌐 Public |
| `POST` | `/quizzes/questions` | Tạo câu hỏi quiz mới | 🌐 Public |
| `POST` | `/quizzes/questions/list` | Tạo nhiều câu hỏi quiz cùng lúc (batch) | 🌐 Public |
| `PUT` | `/quizzes/questions/:id` | Cập nhật câu trả lời quiz | 🌐 Public |
| `GET` | `/quizzes/user/:userId/check-first-time` | Kiểm tra user đã làm quiz chưa | 🌐 Public |
| `POST` | `/quizzes/user?userId=` | Trả lời quiz và nhận gợi ý nước hoa từ AI | 🌐 Public |

**Cách sử dụng:**
```bash
# Lấy câu hỏi quiz
curl http://localhost:3000/quizzes/questions

# Trả lời quiz
curl -X POST -H "Content-Type: application/json" \
  -d '[{"questionId":"<qId>","answerId":"<aId>"}]' \
  "http://localhost:3000/quizzes/user?userId=<userId>"
```

> **Lưu ý:**
> - Endpoint `POST /quizzes/user` thực hiện nhiều bước: lấy câu hỏi → match câu trả lời → tạo prompt → lưu quiz answer → lưu user log → gọi AI.
> - ⚠️ Việc lưu user log (`addQuizQuesAnsDetailToUserLog`) chạy fire-and-forget, có thể gây lỗi FK violation nếu entity chưa flush xong. Trong test cần mock phần này.
> - Tất cả endpoint đều public — bao gồm cả endpoint tạo/cập nhật câu hỏi. Trong production nên bảo vệ các endpoint tạo/cập nhật bằng role admin.

---

### 11. LogController

**Route:** `/logs` | **Auth:** 🌐 Public | **Tag Swagger:** `Logs`

Quản lý log hoạt động người dùng — thu thập, tóm tắt bằng AI, và tự động chạy cron job.

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `GET` | `/logs/report/activity` | Lấy báo cáo log hoạt động (raw text) | 🌐 Public |
| `GET` | `/logs/summarize` | Tóm tắt log bằng AI và lưu vào DB | 🌐 Public |
| `GET` | `/logs/summarize/all` | Tóm tắt log tất cả user bằng AI (không lưu DB) | 🌐 Public |
| `GET` | `/logs/summaries?userId=&startDate=&endDate=` | Xem các bản tóm tắt đã lưu | 🌐 Public |
| `GET` | `/logs/report/summary?userId=&startDate=&endDate=` | Xem báo cáo tóm tắt theo userId | 🌐 Public |
| `POST` | `/logs` | Tạo bản tóm tắt log thủ công | 🌐 Public |

**Cron Jobs (tự động):**

| Schedule | Mô tả |
|----------|-------|
| Mỗi tuần (`EVERY_WEEK`) | Tóm tắt log tất cả user theo tuần và lưu DB |
| Mỗi ngày 10:00 AM (`EVERY_DAY_AT_10AM`) | Tóm tắt log tất cả user theo ngày và lưu DB |

**Cách sử dụng:**
```bash
# Tóm tắt log user bằng AI
curl "http://localhost:3000/logs/summarize?userId=<userId>&period=monthly&endDate=2025-02-10"

# Xem các bản tóm tắt đã lưu
curl "http://localhost:3000/logs/summaries?userId=<userId>&startDate=2025-01-01&endDate=2025-02-10"
```

> **Lưu ý:**
> - Query param `period` hỗ trợ: `daily`, `weekly`, `monthly`.
> - Endpoint `/summarize` sẽ **lưu kết quả vào DB** sau khi AI tóm tắt. Endpoint `/summarize/all` **không lưu**.
> - Cron job tự động chạy khi server hoạt động. Mỗi lần quét tất cả userId có trong log rồi tóm tắt từng user.
> - AI sử dụng Admin Instructions domain `log` (nếu có).

---

### 12. TrendController

**Route:** `/trends` | **Auth:** 🌐 Public | **Tag Swagger:** `Trends`

Dự đoán xu hướng nước hoa dựa trên tổng hợp log hoạt động của tất cả người dùng.

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `POST` | `/trends/summary` | Dự đoán xu hướng bằng AI (text) | 🌐 Public |
| `POST` | `/trends/summary/structured` | Dự đoán xu hướng AI có cấu trúc (JSON + metadata) | 🌐 Public |

**Cách sử dụng:**
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"period":"monthly","endDate":"2025-02-10"}' \
  http://localhost:3000/trends/summary
```

> **Lưu ý:**
> - Cần có dữ liệu log hoạt động trong DB. Nếu không có → trả về insufficient data message.
> - AI xử lý 2 bước: (1) tóm tắt log → (2) dự đoán xu hướng dựa trên bản tóm tắt.
> - Endpoint `/structured` trả thêm: `period`, `analyzedLogCount`, `processingTimeMs`, `generatedAt`.
> - AI sử dụng Admin Instructions domain `trend` (nếu có) kết hợp với `ADVANCED_MATCHING_SYSTEM_PROMPT`.

---

### 13. RecommendationController

**Route:** `/recommendation` | **Auth:** 🌐 Public | **Tag Swagger:** `Recommendation`

Gợi ý sản phẩm nước hoa dựa trên lịch sử hoạt động và đơn hàng của người dùng.

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `POST` | `/recommendation/repurchase/v1` | Gợi ý mua lại V1 — dùng log tóm tắt | 🌐 Public |
| `POST` | `/recommendation/repurchase/v2` | Gợi ý mua lại V2 — dùng log chi tiết | 🌐 Public |
| `POST` | `/recommendation/recommend/ai/v1` | Gợi ý AI V1 — dùng log chi tiết | 🌐 Public |
| `POST` | `/recommendation/recommend/ai/v2` | Gợi ý AI V2 — dùng log tóm tắt | 🌐 Public |
| `POST` | `/recommendation/recommend/ai/structured` | Gợi ý AI có cấu trúc (JSON + metadata) | 🌐 Public |

**Cách sử dụng:**
```bash
# Gợi ý mua lại
curl -X POST -H "Content-Type: application/json" \
  -d '{"userId":"<userId>","period":"monthly","endDate":"2025-02-10"}' \
  http://localhost:3000/recommendation/repurchase/v2

# Gợi ý AI có cấu trúc
curl -X POST -H "Content-Type: application/json" \
  -d '{"userId":"<userId>","period":"monthly","endDate":"2025-02-10"}' \
  http://localhost:3000/recommendation/recommend/ai/structured
```

> **Lưu ý:**
> - **Repurchase V1/V2** kết hợp user log + order history để gợi ý mua lại sản phẩm đã mua.
> - **Recommend AI V1/V2** gợi ý sản phẩm mới dựa trên sở thích phân tích từ log.
> - Body request là `UserLogRequest` gồm: `userId`, `period`, `startDate`, `endDate`.
> - Nếu user không có log và không có order → trả về insufficient data message.
> - ⚠️ Endpoint repurchase sử dụng `OrderService` → bị ảnh hưởng bởi bug `orders.data` (xem OrderController).
> - AI sử dụng Admin Instructions domain `recommendation` kết hợp `ADVANCED_MATCHING_SYSTEM_PROMPT`.

---

### 14. AIController

**Route:** `/ai` | **Auth:** 🌐 Public | **Tag Swagger:** `AI`

Endpoint đơn giản để tìm kiếm/hỏi đáp trực tiếp với AI mà không cần context về user hay sản phẩm.

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `POST` | `/ai/search?prompt=` | Tìm kiếm/hỏi đáp với AI | 🌐 Public |

**Cách sử dụng:**
```bash
curl -X POST "http://localhost:3000/ai/search?prompt=Nước hoa nào phù hợp cho mùa đông?"
```

> **Lưu ý:**
> - Endpoint này gọi thẳng `aiService.textGenerateFromPrompt` mà **không có system prompt** hay admin instruction.
> - Kết quả phụ thuộc hoàn toàn vào model AI mặc định (OpenAI GPT).
> - Phù hợp cho việc test nhanh hoặc hỏi đáp tổng quát.

---

### Ghi chú chung về Controller

1. **Response format:** Tất cả controller đều trả về cấu trúc `BaseResponse<T>`:
   ```json
   { "success": true, "data": <T> }
   // hoặc
   { "success": false, "error": "Error message" }
   ```

2. **Endpoint `/structured`:** Các phiên bản structured trả thêm `metadata` gồm `processingTimeMs` (thời gian xử lý AI), `generatedAt` (thời điểm tạo).

3. **Insufficient data:** Khi không đủ dữ liệu để phân tích, AI không được gọi. Thay vào đó trả về message mặc định → tiết kiệm token OpenAI.

4. **Backend .NET dependency:** Các controller Products, Orders, Inventory, Reviews, Profile đều gọi API tới backend .NET. **Cần backend .NET chạy song song** (mặc định `https://localhost:7011/api`).

5. **Admin Instructions:** Hầu hết các endpoint AI đều hỗ trợ Admin Instructions — cho phép admin tùy chỉnh hành vi AI qua API thay vì sửa code.

6. **Swagger / API Reference:** Truy cập `http://localhost:3000/reference` để xem Scalar API docs với đầy đủ schema, parameters, response types.

---

## Tóm tắt nhanh

| Bước | Lệnh / Hành động                              | Mô tả                                     |
| ---- | ---------------------------------------------- | ------------------------------------------ |
| 1    | `pnpm install`                                 | Cài đặt dependencies (dùng pnpm)           |
| 2    | `docker run ... postgres:16`                   | Chạy PostgreSQL bằng Docker                |
| 3    | Tạo file `.env`                                | Cấu hình biến môi trường                   |
| 4    | `cp host-config.mjs.example host-config.mjs`   | Cấu hình kết nối database                  |
| 5    | Copy `public_key.pem` vào thư mục gốc         | Cấu hình RSA public key cho JWT            |
| 6    | `npx mikro-orm debug`                          | Kiểm tra kết nối database                  |
| 7    | `npx mikro-orm migration:up`                   | Chạy migration tạo bảng                    |
| 8    | `pnpm run seed`                                | Seed dữ liệu Admin Instructions mặc định   |
| 9    | `pnpm run start:dev`                           | Khởi chạy server development               |

> **Nhớ:** Cần chạy [perfume-gpt-backend](https://github.com/FPTU-ChillGuys/perfume-gpt-backend) (.NET) song song để sử dụng đầy đủ các chức năng (Product, Order, Inventory, Review, ...).
