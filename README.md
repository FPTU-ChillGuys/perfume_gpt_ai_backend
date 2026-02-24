# Perfume GPT AI Backend

> AI Chatbot backend cho hệ thống PerfumeGPT - được xây dựng bằng NestJS, MikroORM (PostgreSQL), Prisma (SQL Server), BullMQ (Redis) và OpenAI.

## Mục lục

- [Yêu cầu hệ thống](#yêu-cầu-hệ-thống)
- [Cài đặt từng bước](#cài-đặt-từng-bước)
  - [Bước 1: Clone repository & cài đặt dependencies](#bước-1-clone-repository--cài-đặt-dependencies)
  - [Bước 2: Cài đặt PostgreSQL (Docker)](#bước-2-cài-đặt-postgresql-docker)
  - [Bước 2b: Cài đặt Redis (Docker)](#bước-2b-cài-đặt-redis-docker)
  - [Bước 3: Cấu hình file môi trường (.env)](#bước-3-cấu-hình-file-môi-trường-env)
  - [Bước 4: Cấu hình kết nối database (host-config.mjs)](#bước-4-cấu-hình-kết-nối-database-host-configmjs)
  - [Bước 5: Cấu hình RSA Keys (public_key.pem)](#bước-5-cấu-hình-rsa-keys-public_keypem)
  - [Bước 6: Kiểm tra kết nối database](#bước-6-kiểm-tra-kết-nối-database)
  - [Bước 7: Chạy migration](#bước-7-chạy-migration)
  - [Bước 8: Seed dữ liệu mặc định](#bước-8-seed-dữ-liệu-mặc-định)
  - [Bước 9: Chạy project](#bước-9-chạy-project)
- [Admin Instructions (Chỉ thị AI)](#admin-instructions-chỉ-thị-ai)
- [BullMQ — Job Queue (Redis)](#bullmq--job-queue-redis)
- [Prisma — Kết nối SQL Server (.NET DB)](#prisma--kết-nối-sql-server-net-db)
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
  - [15. EmailController](#15-emailcontroller)
  - [Ghi chú chung về Controller](#ghi-chú-chung-về-controller)

---

## Yêu cầu hệ thống

| Tool           | Phiên bản tối thiểu | Ghi chú                                          |
| -------------- | -------------------- | ------------------------------------------------ |
| **Node.js**    | >= 18                |                                                  |
| **pnpm**       | >= 8                 | **Sử dụng pnpm, KHÔNG dùng npm**                 |
| **Docker**     | Latest               | Để chạy PostgreSQL và Redis                      |
| **PostgreSQL** | >= 14                | AI DB — chạy qua Docker, quản lý bởi MikroORM   |
| **Redis**      | >= 7                 | Job queue cho BullMQ — chạy qua Docker           |
| **SQL Server** | >= 2019              | Main DB của .NET backend — truy cập qua Prisma   |
| **.NET SDK**   | >= 8.0               | Cho backend chính (perfume-gpt-backend)          |

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

### Bước 2b: Cài đặt Redis (Docker)

BullMQ sử dụng **Redis** làm backend lưu trữ job queue. Cài Redis qua Docker:

```bash
docker run --name perfume-gpt-redis \
  -p 6379:6379 \
  -d redis:7
```

Kiểm tra Redis đang chạy:

```bash
docker ps
# hoặc kiểm tra kết nối
docker exec -it perfume-gpt-redis redis-cli ping
# OUTPUT: PONG
```

> **Lưu ý:**
> - Redis mặc định chạy trên port `6379`, host `localhost`.
> - Không cần mật khẩu khi chạy local. Nếu triển khai production, nên thêm xác thực Redis.
> - Nếu Redis không chạy, các endpoint chat **V5/V6** sẽ báo lỗi connection.

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

# Redis (BullMQ job queue + Cache store)
REDIS_HOST=localhost
REDIS_PORT=6379

# SQL Server — Prisma kết nối trực tiếp vào DB của .NET backend (dùng adapter riêng lẻ)
SQL_SERVER_DATABASE_SERVER=localhost
SQL_SERVER_DATABASE_PORT=1433
SQL_SERVER_DATABASE_USER=sa
SQL_SERVER_DATABASE_PASSWORD=your_mssql_password
SQL_SERVER_DATABASE_NAME=PerfumeGPT

# Prisma config file vẫn cần biến này cho CLI (npx prisma generate)
SQL_SERVER_DATABASE_URL=sqlserver://localhost:1433;database=PerfumeGPT;user=sa;password=your_mssql_password;trustServerCertificate=true

# Cache (in-memory + Redis)
CACHE_TTL=60000
CACHE_LRU_SIZE=5000

# Google Gmail — NodeMailer gửi email qua SMTP
GOOGLE_EMAIL=your_gmail@gmail.com
GOOGLE_APP_PASSWORD=your_app_password
```

> **Lưu ý:**
> - `BASE_URL` trỏ tới backend .NET (`perfume-gpt-backend`). Mặc định là `https://localhost:7011/api`.
> - `JWT_ISSUER` và `JWT_AUDIENCE` phải **trùng khớp** với cấu hình JWT bên repo `perfume-gpt-backend`.
> - `OPENAI_API_KEY` là API key từ OpenAI để sử dụng các tính năng AI.
> - `REDIS_HOST` / `REDIS_PORT` là địa chỉ Redis dùng cho BullMQ job queue **và** Cache store (mặc định `localhost:6379`).
> - **SQL Server (Prisma):** Ứng dụng dùng **2 cách** kết nối SQL Server:
>   - `SQL_SERVER_DATABASE_SERVER`, `_PORT`, `_USER`, `_PASSWORD`, `_NAME` — dùng bởi `PrismaService` trong runtime (adapter `@prisma/adapter-mssql`).
>   - `SQL_SERVER_DATABASE_URL` — dùng bởi Prisma CLI (`npx prisma generate`) để introspect schema.
> - `CACHE_TTL` / `CACHE_LRU_SIZE` — cấu hình cache (TTL tính bằng ms, mặc định 60000ms = 1 phút; LRU size mặc định 5000 entries).
> - `GOOGLE_EMAIL` / `GOOGLE_APP_PASSWORD` dùng để gửi email qua Gmail SMTP. Cần tạo [App Password](https://support.google.com/accounts/answer/185833) trong Google Account nếu dùng 2FA.

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
| `trend`          | Hướng dẫn dự đoán xu hướng                  | `GET /trends/summary*`                   |
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

## BullMQ — Job Queue (Redis)

Project sử dụng **BullMQ** với **Redis** để xử lý các tác vụ nặng (lưu conversation, log) trong background, giúp giảm thời gian chờ cho người dùng.

### Tại sao cần BullMQ?

Khi user gửi chat, nếu server phải **đợi lưu DB xong** mới trả về → latency cao. BullMQ cho phép:
1. AI trả lời ngay cho user
2. Việc lưu conversation + user log được đẩy vào **queue** và xử lý background

### Queues và Processors

| Queue | Processor | Trigger | Nhiệm vụ |
|-------|-----------|---------|---------|
| `conversation-queue` | `ConversationProcessor` | Chat V5/V6/V7 | Lưu conversation + messages vào PostgreSQL |
| `quiz-queue` | `QuizProcessor` | Quiz submit V2 | Lưu quiz answer, log quiz vào PostgreSQL |

### Luồng hoạt động (Chat V5/V6/V7)

```
User POST /conversation/chat/v5
        ↓
Controller gọi AI → nhận response ngay
        ↓
Push job vào conversation-queue (Redis)
        ↓
Trả về AI response cho user NGAY LẬP TỨC
        ↓ (background)
ConversationProcessor: lưu conversation + messages + user log vào DB
```

### Cấu hình

BullMQ đọc Redis connection từ `.env`:

```env
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Quản lý jobs

Xóa toàn bộ jobs trong queue (dùng khi debug):

```bash
pnpm run bullmq:delete-all-jobs
```

> **Lưu ý:**
> - Nếu Redis không chạy, các endpoint **V5/V6/V7** và **Quiz V2** sẽ báo lỗi kết nối. Các endpoint V1–V4 và Quiz V1 vẫn hoạt động bình thường.
> - Jobs failed sẽ được retry tự động theo cấu hình mặc định của BullMQ.
> - Trong development, dùng [Bull Board](https://github.com/felixmosh/bull-board) để visualize jobs (chưa tích hợp sẵn — có thể thêm nếu cần).

---

## Prisma — Kết nối SQL Server (.NET DB)

Project sử dụng **Prisma** để kết nối trực tiếp vào **SQL Server database của .NET backend** (`perfume-gpt-backend`). Điều này cho phép AI đọc dữ liệu sản phẩm, đơn hàng, inventory, v.v. **mà không cần gọi HTTP API** — nhanh hơn và phù hợp cho batch processing.

### Khi nào Prisma được dùng?

| Tình huống | Dùng Axios (HTTP) | Dùng Prisma (direct DB) |
|-----------|-------------------|------------------------|
| Chatbot real-time cần dữ liệu nhanh | ✅ | — |
| Cron job xử lý nhiều user cùng lúc | — | ✅ |
| Recommendation batch | — | ✅ |
| Tìm kiếm sản phẩm với filter phức tạp | — | ✅ |

### Schema

Prisma schema được generated từ SQL Server schema của `.NET backend`:

```
prisma/
└── schema.prisma     ← Schema ánh xạ từ SQL Server (auto-generated)

generated/
└── prisma/
    ├── client.ts     ← Prisma Client (type-safe)
    ├── models.ts     ← TypeScript types
    └── enums.ts      ← Enums
```

### Cấu hình

Prisma sử dụng **2 cơ chế kết nối** khác nhau:

#### 1. Runtime — `PrismaService` (adapter `@prisma/adapter-mssql`)

Khi app chạy, `PrismaService` tạo kết nối qua adapter riêng, đọc từng biến `.env` riêng lẻ:

```env
SQL_SERVER_DATABASE_SERVER=localhost
SQL_SERVER_DATABASE_PORT=1433
SQL_SERVER_DATABASE_USER=sa
SQL_SERVER_DATABASE_PASSWORD=your_mssql_password
SQL_SERVER_DATABASE_NAME=PerfumeGPT
```

```typescript
// src/prisma/prisma.service.ts
const adapter = new PrismaMssql({
  server: process.env.SQL_SERVER_DATABASE_SERVER ?? 'localhost',
  port: Number(process.env.SQL_SERVER_DATABASE_PORT),
  user: process.env.SQL_SERVER_DATABASE_USER,
  password: process.env.SQL_SERVER_DATABASE_PASSWORD,
  database: process.env.SQL_SERVER_DATABASE_NAME,
  options: { encrypt: false, trustServerCertificate: true }
});
super({ adapter });
```

#### 2. CLI — `prisma.config.ts` (dùng cho `npx prisma generate`)

```env
SQL_SERVER_DATABASE_URL=sqlserver://localhost:1433;database=PerfumeGPT;user=sa;password=your_mssql_password;trustServerCertificate=true
```

> **Quan trọng:** Cả 2 bộ biến (`SQL_SERVER_DATABASE_*` riêng lẻ + `SQL_SERVER_DATABASE_URL`) đều cần có trong `.env`. Riêng lẻ cho runtime, URL cho CLI.

### Sử dụng trong code

Prisma được inject qua `PrismaModule` (global) và `PrismaService`:

```typescript
// Inject vào service
constructor(private readonly prisma: PrismaService) {}

// Query ví dụ
const products = await this.prisma.products.findMany({
  where: { IsActive: true },
  take: 10
});
```

### Regenerate Prisma Client (khi .NET DB thay đổi schema)

```bash
npx prisma generate --config prisma.config.ts
```

> **Lưu ý:** Prisma trong project này chỉ **đọc** (read-only) từ SQL Server. Mọi thay đổi dữ liệu phải thực hiện qua .NET backend. Không chạy `prisma migrate` vào SQL Server này.

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
│  - BullMQ Jobs      │                     │                          │
└──┬──────────┬───────┘                     └────────────┬─────────────┘
   │          │                                          │
   │ MikroORM │ Prisma (read-only)                      │ EF Core
   │          └──────────────────────────────────────┐  │
   ▼                                                  ▼  ▼
┌───────────┐      BullMQ         ┌───────┐    ┌───────────────┐
│PostgreSQL │    (job queue)      │ Redis │    │  SQL Server   │
│(AI Data)  │ <──────────────┐   │ :6379 │    │  (Main Data)  │
└───────────┘                │   └───────┘    └───────────────┘
                              │       │
                    ConversationProcessor
                    QuizProcessor
                    (background jobs)
```

### Tech Stack

| Layer | Technology | Mục đích |
|-------|-----------|---------| 
| **Framework** | NestJS 11 | HTTP server, DI, module system |
| **AI** | AI SDK + OpenAI GPT | Text generation, structured output |
| **ORM chính** | MikroORM 6 | Quản lý AI DB (PostgreSQL) |
| **ORM phụ** | Prisma 7 + `@prisma/adapter-mssql` | Đọc dữ liệu từ SQL Server (.NET DB) |
| **Job Queue** | BullMQ 5 + @nestjs/bullmq | Background jobs (lưu conversation, quiz, log) |
| **Job Store** | Redis 7 | Backend lưu trữ BullMQ jobs |
| **Cache** | @nestjs/cache-manager + cacheable + @keyv/redis | Cache 2 tầng: in-memory (LRU) + Redis |
| **Email** | NodeMailer + @nestjs-modules/mailer | Gửi email gợi ý qua Gmail SMTP |
| **HTTP Client** | @nestjs/axios | Gọi API tới .NET backend |
| **Auth** | JWT RS256 | Verify token từ .NET backend |
| **API Docs** | @scalar/nestjs-api-reference | API Reference tại `/reference` |
| **Mapping** | @automapper | DTO ↔ Entity mapping |
| **Scheduler** | @nestjs/schedule | Cron jobs (log summarize, recommendation) |

---

## HTTP Status Codes & Response Format

Tất cả API responses đều tuân theo chuỗi xử lý sau:
1. **Success Response Interceptor** tự động wrap các response 2xx vào định dạng chuẩn
2. **HTTP Exception Filter** bắt tất cả exceptions và format lại theo chuẩn error response

### Success Responses (2xx)

Tất cả responses thành công sẽ có cấu trúc:

```json
{
  "success": true,
  "data": <T>  // Có thể là object, array, string, number, hoặc null
}
```

| HTTP Code | Ý nghĩa | Khi nào sử dụng | Ví dụ Response |
|-----------|---------|-----------------|----------------|
| **200 OK** | Thành công | Hầu hết các GET/POST/PUT requests | `{ "success": true, "data": { "id": "123", "name": "Product" } }` |
| **201 Created** | Tạo thành công | Tạo mới resource (hiện tại chưa dùng) | `{ "success": true, "data": { "id": "new-123" } }` |
| **202 Accepted** | Đã chấp nhận | Background job được trigger (hiện tại chưa dùng) | `{ "success": true, "data": "Processing..." }` |
| **204 No Content** | Không có nội dung | Xóa thành công, không cần trả data (hiện tại chưa dùng) | *(No response body)* |

> **Lưu ý:** Hệ thống hiện tại chủ yếu trả về **200 OK** cho tất cả success cases. Helper `Created()`, `Accepted()`, `NoContent()` đã được tạo nhưng chưa áp dụng rộng rãi.

### Error Responses (4xx, 5xx)

Tất cả errors đều có cấu trúc:

```json
{
  "success": false,
  "data": null,
  "error": "Error message",
  "detail": {  // Optional - chỉ xuất hiện khi có thông tin bổ sung
    "field": "email",
    "reason": "Invalid format"
  },
  "statusCode": 400
}
```

| HTTP Code | Ý nghĩa | Khi nào xảy ra | Ví dụ Response |
|-----------|---------|----------------|----------------|
| **400 Bad Request** | Request không hợp lệ | Thiếu query params, body sai format, validation failed | `{ "success": false, "error": "Missing required field: userId", "detail": { "field": "userId" }, "statusCode": 400 }` |
| **401 Unauthorized** | Chưa xác thực | Không có Bearer token, token hết hạn, token không hợp lệ | `{ "success": false, "error": "Unauthorized", "statusCode": 401 }` |
| **403 Forbidden** | Không có quyền | User không có role admin khi truy cập endpoint protected | `{ "success": false, "error": "Forbidden resource", "statusCode": 403 }` |
| **404 Not Found** | Không tìm thấy resource | ID không tồn tại trong database | `{ "success": false, "error": "Admin instruction not found", "statusCode": 404 }` |
| **409 Conflict** | Xung đột dữ liệu | Tạo trùng unique constraint | `{ "success": false, "error": "Duplicate entry", "statusCode": 409 }` |
| **500 Internal Server Error** | Lỗi server | Database connection fail, AI service down, unhandled exception | `{ "success": false, "error": "Internal server error", "statusCode": 500 }` |

### Response Helpers

Backend sử dụng các helper functions để trả về success responses:

| Helper | HTTP Code | Usage |
|--------|-----------|-------|
| `Ok(data)` | 200 | `return Ok({ message: "Success" })` |
| `Ok()` | 200 | `return Ok()` → `{ "success": true, "data": null }` |
| `Created(data)` | 201 | `return Created({ id: "new-123" })` |
| `Accepted(data)` | 202 | `return Accepted({ jobId: "job-456" })` |
| `NoContent()` | 204 | `return NoContent()` → No response body |

> **Backward compatibility:** Manual `return { success: true, data: ... }` vẫn hoạt động nhưng đã được refactor thành `Ok()` helpers trong toàn bộ codebase.

### Custom Exceptions

Backend cung cấp các exception classes với support cho `detail` field:

| Exception Class | HTTP Code | Usage |
|-----------------|-----------|-------|
| `BadRequestWithDetailsException` | 400 | `throw new BadRequestWithDetailsException('Invalid email', { field: 'email' })` |
| `UnauthorizedWithDetailsException` | 401 | `throw new UnauthorizedWithDetailsException('Token expired', { expiredAt: Date.now() })` |
| `ForbiddenWithDetailsException` | 403 | `throw new ForbiddenWithDetailsException('Admin only', { requiredRole: 'admin' })` |
| `NotFoundWithDetailsException` | 404 | `throw new NotFoundWithDetailsException('User not found', { userId: '123' })` |
| `ConflictWithDetailsException` | 409 | `throw new ConflictWithDetailsException('Duplicate email', { email: 'test@test.com' })` |
| `InternalServerErrorWithDetailsException` | 500 | `throw new InternalServerErrorWithDetailsException('Database error', { query: 'SELECT *' })` |

### Error Handling Strategy

**Codebase pattern (đang được refactor):**

1. **Success responses:** Tất cả success cases đã được refactor để dùng `Ok()` helper thay vì manual object literals
2. **Error responses:** Đang trong quá trình refactor từ `return { success: false, error: '...' }` sang `throw CustomException(...)`

**Tất cả controllers đã áp dụng exception pattern (47 conversions):**
- ✅ **QuizController** - Tất cả errors throw exceptions với context detail
- ✅ **LogController** - HTTP endpoints throw exceptions (cron jobs giữ nguyên return)
- ✅ **AIController** - AI service failures throw `InternalServerErrorWithDetailsException`
- ✅ **ProfileController** - External service failures throw exceptions
- ✅ **InventoryController** - AI and service failures throw exceptions
- ✅ **ConversationController** - 16 exceptions với context (userId, conversationId, service, endpoint)
- ✅ **TrendController** - 6 exceptions với context (service, period, endpoint)
- ✅ **ReviewController** - 6 exceptions với context (variantId, service, endpoint)
- ✅ **RecommendationController** - 15 exceptions với context (userId, service, endpoint)
- ✅ **OrderController** - 4 exceptions với context (userId, service, endpoint)

**Best practices khi implement endpoints mới:**

```typescript
// ✅ GOOD: Throw exception với detail cho errors
async createResource(@Body() dto: CreateDto) {
  const result = await this.service.create(dto);
  
  if (!result.success) {
    throw new BadRequestWithDetailsException(
      'Failed to create resource',
      { reason: result.error, input: dto }
    );
  }
  
  return Ok(result.data);
}

// ❌ BAD: Manual error return (legacy pattern)
async createResource(@Body() dto: CreateDto) {
  const result = await this.service.create(dto);
  
  if (!result.success) {
    return { success: false, error: 'Failed to create resource' };
  }
  
  return { success: true, data: result.data };
}
```

**Exception detail guidelines:**
- Luôn include context giúp debug (userId, service name, input parameters)
- Không include sensitive data (passwords, tokens) trong detail object
- Use English cho error messages (để consistency với NestJS framework)


---

## Chi tiết các Controller

Hệ thống gồm **13 controller** (1 trong `AppModule`, 12 trong `ProviderModule`) chia theo quyền truy cập:

### Bảng tổng quan

| Controller | Route prefix | Auth | Role | Số endpoint |
|---|---|---|---|---|
| [AppController](#1-appcontroller) | `/` | 🌐 Public | — | 1 |
| [AdminInstructionController](#2-admininstructioncontroller) | `/admin/instructions` | 🔒 JWT | `admin` | 7 |
| [AIAcceptanceController](#3-aiacceptancecontroller) | `/ai-acceptance` | 🔒 JWT | — | 5 |
| [OrderController](#4-ordercontroller) | `/orders` | 🔒 JWT | `admin` | 4 |
| [InventoryController](#5-inventorycontroller) | `/inventory` | 🔒 JWT | `admin` | 7 |
| [ConversationController](#6-conversationcontroller) | `/conversation` | Hỗn hợp | `admin` (CRUD) | 10 |
| [ProductController](#7-productcontroller) | `/products` | 🌐 Public | — | 2 |
| [ProfileController](#8-profilecontroller) | `/profile` | 🔒 JWT | `admin` | 2 |
| [ReviewController](#9-reviewcontroller) | `/reviews` | 🌐 Public | — | 7 |
| [QuizController](#10-quizcontroller) | `/quizzes` | 🌐 Public | — | 10 |
| [LogController](#11-logcontroller) | `/logs` | 🔒 JWT | `admin` (1 public) | 12 (+1 cron) |
| [TrendController](#12-trendcontroller) | `/trends` | 🔒 JWT | `admin` | 2 |
| [RecommendationController](#13-recommendationcontroller) | `/recommendation` | 🌐 Public | — | 5 |
| [AIController](#14-aicontroller) | `/ai` | 🌐 Public | — | 1 |
| [EmailController](#15-emailcontroller) | `/email` | 🔒 JWT | `admin` | 1 |

> **Ký hiệu:**
> - 🔒 = Yêu cầu Bearer JWT token
> - 🌐 = Truy cập tự do, không cần token

---

### 1. AppController

**Route:** `/` | **Auth:** 🌐 Public (`@Public()`) | **Tag Swagger:** `App`

Health check endpoint, kiểm tra server có đang hoạt động hay không.

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `GET` | `/` | Health check - trả về chuỗi xác nhận server đang chạy | 🌐 Public |

**Cách sử dụng:**
```bash
curl http://localhost:3000/
```

**HTTP Status Codes:**

| Code | Khi nào | Response Body |
|------|---------|---------------|
| 200 | Server đang chạy | `{ "success": true, "data": "Perfume GPT AI Backend is running!" }` |
| 500 | Server lỗi nội bộ | `{ "success": false, "error": "Internal server error", "statusCode": 500 }` |

> **Lưu ý:** Endpoint này có `@Public()` nên **không cần** Bearer token để truy cập.

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

**HTTP Status Codes:**

| Code | Khi nào | Response Body Example |
|------|---------|----------------------|
| 200 | Request thành công | `{ "success": true, "data": { "id": "123", "instructionType": "review", ...} }` |
| 400 | Thiếu field bắt buộc, `instructionType` không hợp lệ | `{ "success": false, "error": "Invalid instructionType", "statusCode": 400 }` |
| 401 | Không có token hoặc token không hợp lệ | `{ "success": false, "error": "Unauthorized", "statusCode": 401 }` |
| 403 | User không có role admin | `{ "success": false, "error": "Forbidden resource", "statusCode": 403 }` |
| 404 | Admin instruction ID không tồn tại (GET/PUT/DELETE by ID) | `{ "success": false, "error": "Admin instruction not found", "statusCode": 404 }` |
| 500 | Lỗi database, lỗi nội bộ | `{ "success": false, "error": "Internal server error", "statusCode": 500 }` |

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

**HTTP Status Codes:**

| Code | Khi nào | Response Body Example |
|------|---------|----------------------|
| 200 | Request thành công | `{ "success": true, "data": { "acceptanceRate": 0.85, "totalRecords": 100 } }` |
| 400 | Thiếu userId, status/isAccepted format sai | `{ "success": false, "error": "Invalid parameter", "statusCode": 400 }` |
| 401 | Token không hợp lệ | `{ "success": false, "error": "Unauthorized", "statusCode": 401 }` |
| 404 | AI acceptance record không tồn tại (UPDATE by ID) | `{ "success": false, "error": "AI acceptance not found", "statusCode": 404 }` |
| 500 | Lỗi database | `{ "success": false, "error": "Internal server error", "statusCode": 500 }` |

> **Lưu ý:**
> - Query param `status` và `isAccepted` nhận giá trị string `"true"` hoặc `"false"`, sẽ được parse thành boolean.
> - Endpoint `POST record/:userId` có logic đảo ngược: truyền `isAccepted=false` → lưu `true` (và ngược lại). Cần kiểm tra lại logic này nếu cần chính xác.

---

### 4. OrderController

**Route:** `/orders` | **Auth:** 🔒 JWT + Role `admin` | **Tag Swagger:** `Orders`

Quản lý đơn hàng — lấy danh sách đơn hàng từ backend .NET và tạo báo cáo phân tích bằng AI.

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `GET` | `/orders` | Lấy danh sách tất cả đơn hàng | 🔒 admin |
| `GET` | `/orders/user/:userId` | Lấy đơn hàng theo userId | 🔒 admin |
| `GET` | `/orders/summary/ai?userId=` | Tạo báo cáo tóm tắt đơn hàng bằng AI (text) | 🔒 admin |
| `GET` | `/orders/summary/ai/structured?userId=` | Tạo báo cáo AI có cấu trúc (JSON + metadata) | 🔒 admin |

**Cách sử dụng:**
```bash
# Lấy tất cả đơn hàng
curl -H "Authorization: Bearer <token>" http://localhost:3000/orders

# Báo cáo AI theo user
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/orders/summary/ai?userId=<userId>"
```

**HTTP Status Codes:**

| Code | Khi nào | Response Body Example |
|------|---------|----------------------|
| 200 | Request thành công | `{ "success": true, "data": [{ "orderId": "123", "totalAmount": 500000, ... }] }` |
| 400 | Thiếu userId khi gọi `/summary/ai` | `{ "success": false, "error": "Missing userId parameter", "statusCode": 400 }` |
| 401 | Token không hợp lệ hoặc hết hạn | `{ "success": false, "error": "Unauthorized", "statusCode": 401 }` |
| 500 | Backend .NET down, lỗi kết nối, lỗi database | `{ "success": false, "error": "Internal server error", "statusCode": 500 }` |

> **Lưu ý:**
> - ⚠️ **Bug trong source code:** `OrderService.getOrderReportFromGetOrderDetailsWithOrdersByUserId` truy cập `orders.data` (undefined) thay vì `orders.payload`, khiến endpoint `/summary/ai` và `/summary/ai/structured` luôn trả về `success: false` hoặc insufficient data message.
> - Cần backend .NET đang chạy để lấy dữ liệu đơn hàng. Bearer token phải hợp lệ từ hệ thống .NET.
> - Endpoint `/structured` trả thêm metadata: `processingTimeMs`, `userId`, `generatedAt`.

---

### 5. InventoryController

**Route:** `/inventory` | **Auth:** 🔒 JWT + Role `admin` | **Tag Swagger:** `Inventory`

Quản lý tồn kho — lấy stock, batch và tạo báo cáo AI phân tích tồn kho.

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `GET` | `/inventory/stock` | Lấy thông tin tồn kho (phân trang) | 🔒 admin |
| `GET` | `/inventory/batches` | Lấy danh sách batch (phân trang) | 🔒 admin |
| `GET` | `/inventory/report` | Lấy báo cáo tồn kho (text thô) | 🔒 admin |
| `GET` | `/inventory/report/ai` | Tạo báo cáo tồn kho bằng AI (text) | 🔒 admin |
| `GET` | `/inventory/report/ai/structured` | Tạo báo cáo tồn kho AI có cấu trúc (JSON + metadata) | 🔒 admin |
| `GET` | `/inventory/report/logs` | Lấy lịch sử báo cáo tồn kho (phân trang) | 🔒 admin |
| `GET` | `/inventory/report/logs/:id` | Lấy chi tiết báo cáo tồn kho theo ID | 🔒 admin |

**Cách sử dụng:**
```bash
# Lấy stock
curl -H "Authorization: Bearer <admin_token>" http://localhost:3000/inventory/stock

# Báo cáo AI
curl -H "Authorization: Bearer <admin_token>" http://localhost:3000/inventory/report/ai

# Lấy lịch sử báo cáo
curl -H "Authorization: Bearer <admin_token>" http://localhost:3000/inventory/report/logs
```

**HTTP Status Codes:**

| Code | Khi nào | Response Body Example |
|------|---------|----------------------|
| 200 | Request thành công | `{ "success": true, "data": { "stockItems": [...], "summary": "..." } }` |
| 400 | Thiếu parameter phân trang, pageSize quá lớn | `{ "success": false, "error": "Invalid pagination parameters", "statusCode": 400 }` |
| 401 | Token không hợp lệ | `{ "success": false, "error": "Unauthorized", "statusCode": 401 }` |
| 403 | User không có role admin | `{ "success": false, "error": "Forbidden resource", "statusCode": 403 }` |
| 500 | Backend .NET down, lỗi database, AI service error | `{ "success": false, "error": "Internal server error", "statusCode": 500 }` |

> **Lưu ý:**
> - Tất cả endpoint đều yêu cầu role `admin` (class-level `@Role('admin')`).
> - Dữ liệu stock/batch được lấy từ backend .NET.
> - Endpoint `report/ai` tự động lưu kết quả thành `InventoryLog` trong PostgreSQL.

---

### 6. ConversationController

**Route:** `/conversation` | **Auth:** Hỗn hợp | **Tag Swagger:** `Conversation`

Controller phức tạp nhất — quản lý chatbot AI tư vấn nước hoa. Gồm 7 phiên bản chat (V1–V7) và CRUD conversation.

#### Endpoint CRUD (Admin only)

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `GET` | `/conversation` | Lấy tất cả cuộc hội thoại | 🔒 admin |
| `GET` | `/conversation/:id` | Lấy cuộc hội thoại theo ID | 🔒 admin |
| `GET` | `/conversation/list/paged` | Lấy danh sách hội thoại có phân trang | 🔒 admin |

#### Endpoint Chat (Public, hỗ trợ JWT tùy chọn)

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `POST` | `/conversation/chat/v1` | Chat V1 — dùng log tóm tắt | 🌐 Public (JWT tùy chọn) |
| `POST` | `/conversation/chat/v2` | Chat V2 — dùng log chi tiết (chậm hơn, đầy đủ hơn) | 🌐 Public (JWT tùy chọn) |
| `POST` | `/conversation/chat/v3` | Chat V3 — cải thiện V1, dùng common helper | 🌐 Public (JWT tùy chọn) |
| `POST` | `/conversation/chat/v4` | Chat V4 — cải thiện V2, dùng common helper | 🌐 Public (JWT tùy chọn) |
| `POST` | `/conversation/chat/v5` | Chat V5 — dùng bull queue + log tóm tắt (xử lý background) | 🌐 Public (JWT tùy chọn) |
| `POST` | `/conversation/chat/v6` | Chat V6 — dùng bull queue + log chi tiết (xử lý background) | 🌐 Public (JWT tùy chọn) |
| `POST` | `/conversation/chat/v7` | Chat V7 — bull queue + `buildCombinedPromptV4` (nhẹ nhất, chỉ log + admin instruction) | 🌐 Public (JWT tùy chọn) |

> **Lưu ý về userId:** `userId` không cần truyền trong request body — hệ thống tự động lấy từ JWT token (`getTokenPayloadFromRequest`). Guest (không có token) vẫn có thể chat nhưng không được lấy log/order/profile.
>
> **V5/V6/V7** sử dụng NestJS Bull queue để xử lý việc lưu conversation và log trong background job. **Khuyến nghị:** Dùng V7 (nhẹ nhất), V5 (log tóm tắt) hoặc V6 (log chi tiết) trong production.
>
> **V7** sử dụng `ConversationRequestDtoV2` (khác với V1-V6 dùng `ConversationRequestDto`) và `buildCombinedPromptV4` — chỉ cần log service + admin instruction, không cần order/profile service.

**Cách sử dụng:**
```bash
# Chat V7 (khuyến nghị) — không cần token (guest)
curl -X POST -H "Content-Type: application/json" \
  -d '{"messages":[{"id":"1","role":"user","content":"Gợi ý nước hoa cho mùa hè","parts":[{"type":"text","text":"Gợi ý nước hoa cho mùa hè"}]}]}' \
  http://localhost:3000/conversation/chat/v7

# Chat V7 — có token (lấy thêm userId + log)
curl -X POST -H "Content-Type: application/json" \
  -H "Authorization: Bearer <user_token>" \
  -d '{"messages":[...]}' \
  http://localhost:3000/conversation/chat/v7
```

**HTTP Status Codes:**

| Code | Khi nào | Response Body Example |
|------|---------|----------------------|
| 200 | Request thành công | `{ "success": true, "data": { "id": "conv-123", "messages": [...] } }` |
| 400 | Thiếu messages trong body, format messages sai | `{ "success": false, "error": "Invalid request format", "statusCode": 400 }` |
| 401 | Token không hợp lệ (chỉ CRUD endpoints) | `{ "success": false, "error": "Unauthorized", "statusCode": 401 }` |
| 403 | Không có quyền admin (chỉ CRUD endpoints) | `{ "success": false, "error": "Forbidden resource", "statusCode": 403 }` |
| 500 | Backend .NET down, AI service error, lỗi database | `{ "success": false, "error": "Internal server error", "statusCode": 500 }` |

> **Lưu ý:**
> - **V1/V3/V5** dùng log tóm tắt (nhanh). **V2/V4/V6** dùng log chi tiết (đầy đủ hơn). **V7** dùng prompt builder V4 (nhẹ nhất).
> - **V5/V6/V7** dùng Bull queue — lưu conversation trong background, tránh timeout.
> - `userId` được lấy từ JWT token. V7 tự tạo UUID nếu không có token.
> - CRUD endpoints (GET conversation) yêu cầu `@Role('admin')`.
> - Conversation được tự động lưu vào PostgreSQL DB.

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

**HTTP Status Codes:**

| Code | Khi nào | Response Body Example |
|------|---------|----------------------|
| 200 | Request thành công | `{ "success": true, "data": { "items": [...], "totalCount": 100 } }` |
| 400 | Thiếu searchText (search endpoint), pageSize quá lớn | `{ "success": false, "error": "Missing searchText parameter", "statusCode": 400 }` |
| 500 | Backend .NET down, lỗi kết nối | `{ "success": false, "error": "Internal server error", "statusCode": 500 }` |

> **Lưu ý:**
> - Dữ liệu được proxy từ backend .NET. Cần backend .NET đang chạy.
> - Hỗ trợ phân trang qua `PagedAndSortedRequest` (pageIndex, pageSize, sorting).

---

### 8. ProfileController

**Route:** `/profile` | **Auth:** 🔒 JWT + Role `admin` | **Tag Swagger:** `Profile`

Lấy thông tin profile của người dùng hiện tại từ backend .NET thông qua JWT token.

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `GET` | `/profile/me` | Lấy thông tin profile từ token | 🔒 admin |
| `GET` | `/profile/report` | Tạo báo cáo profile dưới dạng text | 🔒 admin |

**Cách sử dụng:**
```bash
# Lấy profile (cần admin token)
curl -H "Authorization: Bearer <admin_token>" http://localhost:3000/profile/me
```

**HTTP Status Codes:**

| Code | Khi nào | Response Body Example |
|------|---------|----------------------|
| 200 | Request thành công | `{ "success": true, "data": { "userId": "123", "name": "John", "email": "...", ... } }` |
| 401 | Token không hợp lệ | `{ "success": false, "error": "Unauthorized", "statusCode": 401 }` |
| 403 | User không có role admin | `{ "success": false, "error": "Forbidden resource", "statusCode": 403 }` |
| 500 | Backend .NET down, token không hợp lệ khi gọi .NET | `{ "success": false, "error": "Internal server error", "statusCode": 500 }` |

> **Lưu ý:**
> - Yêu cầu role `admin` (class-level `@Role('admin')`).
> - `userId` được lấy tự động từ JWT token payload (`id` hoặc `sub`).

---

### 9. ReviewController

**Route:** `/reviews` | **Auth:** 🌐 Public | **Tag Swagger:** `Reviews`

Lấy danh sách đánh giá sản phẩm và tóm tắt bằng AI theo variant hoặc toàn bộ.

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `GET` | `/reviews` | Lấy danh sách đánh giá (phân trang) | 🌐 Public |
| `GET` | `/reviews/summary/all` | Tóm tắt đánh giá toàn bộ bằng AI | 🌐 Public |
| `GET` | `/reviews/summary/:variantId` | Tóm tắt đánh giá bằng AI theo variant ID | 🌐 Public |
| `GET` | `/reviews/summary/structured/:variantId` | Tóm tắt AI có cấu trúc (JSON + metadata) | 🌐 Public |
| `POST` | `/reviews/logs` | Thêm review log mới | 🌐 Public |
| `GET` | `/reviews/logs/variant/:variantId` | Lấy review logs theo variant ID | 🌐 Public |
| `GET` | `/reviews/logs/:id` | Lấy review log theo ID | 🌐 Public |

**Cách sử dụng:**
```bash
# Lấy danh sách
curl "http://localhost:3000/reviews?pageIndex=1&pageSize=10"

# Tóm tắt AI theo variant
curl http://localhost:3000/reviews/summary/<variantId>
```

**HTTP Status Codes:**

| Code | Khi nào | Response Body Example |
|------|---------|----------------------|
| 200 | Request thành công | `{ "success": true, "data": "Tóm tắt: Sản phẩm rất tốt..." }` |
| 400 | Thiếu variantId, format pageSize không hợp lệ | `{ "success": false, "error": "Invalid variantId", "statusCode": 400 }` |
| 404 | Variant không tồn tại hoặc không có review nào | `{ "success": false, "error": "No reviews found for variant", "statusCode": 404 }` |
| 500 | Backend .NET down, AI service error (OpenAI API error), lỗi database | `{ "success": false, "error": "Internal server error", "statusCode": 500 }` |

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
| `GET` | `/quizzes/questions/:id` | Lấy câu hỏi quiz theo ID | 🌐 Public |
| `POST` | `/quizzes/questions` | Tạo câu hỏi quiz mới | 🌐 Public |
| `POST` | `/quizzes/questions/list` | Tạo nhiều câu hỏi quiz cùng lúc (batch) | 🌐 Public |
| `PUT` | `/quizzes/questions/:id` | Cập nhật câu trả lời quiz | 🌐 Public |
| `GET` | `/quizzes/user/:userId/check-first-time` | Kiểm tra user đã làm quiz chưa | 🌐 Public |
| `POST` | `/quizzes/user?userId=` | Trả lời quiz V1 và nhận gợi ý nước hoa từ AI | 🌐 Public |
| `POST` | `/quizzes/user/v2?userId=` | Trả lời quiz V2 — dùng Bull queue xử lý background | 🌐 Public |
| `GET` | `/quizzes/user/:userId` | Lấy lịch sử câu hỏi/câu trả lời quiz của user | 🌐 Public |

**Cách sử dụng:**
```bash
# Lấy câu hỏi quiz
curl http://localhost:3000/quizzes/questions

# Trả lời quiz
curl -X POST -H "Content-Type: application/json" \
  -d '[{"questionId":"<qId>","answerId":"<aId>"}]' \
  "http://localhost:3000/quizzes/user?userId=<userId>"
```

**HTTP Status Codes:**

| Code | Khi nào | Response Body Example |
|------|---------|----------------------|
| 200 | Request thành công | `{ "success": true, "data": { "recommendations": [...], "quizAnswerId": "..." } }` |
| 400 | Thiếu userId, questionId/answerId không hợp lệ, body format sai | `{ "success": false, "error": "Missing userId parameter", "statusCode": 400 }` |
| 404 | Question ID hoặc Answer ID không tồn tại | `{ "success": false, "error": "Question or answer not found", "statusCode": 404 }` |
| 500 | AI service error (OpenAI API error), lỗi database | `{ "success": false, "error": "Internal server error", "statusCode": 500 }` |

> **Lưu ý:**
> - Endpoint `POST /quizzes/user` thực hiện nhiều bước: lấy câu hỏi → match câu trả lời → tạo prompt → lưu quiz answer → lưu user log → gọi AI.
> - Việc lưu user log đã được `await` và có cơ chế chống trùng (`ON CONFLICT DO NOTHING`) cho quiz detail log.
> - Tất cả endpoint đều public — bao gồm cả endpoint tạo/cập nhật câu hỏi. Trong production nên bảo vệ các endpoint tạo/cập nhật bằng role admin.

---

### 11. LogController

**Route:** `/logs` | **Auth:** 🔒 JWT + Role `admin` (1 endpoint public) | **Tag Swagger:** `Logs`

Quản lý log hoạt động người dùng — thu thập, tóm tắt bằng AI, và tự động chạy cron job. Kế thừa `LogHelper` cho logic cron.

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `GET` | `/logs/report/activity/alls` | Lấy báo cáo tất cả log hoạt động (raw text) | 🌐 Public |
| `GET` | `/logs/report/activity/user` | Lấy báo cáo log theo userId | 🔒 admin |
| `GET` | `/logs/all` | Lấy tất cả log hoạt động | 🔒 admin |
| `GET` | `/logs/all/period` | Lấy log theo khoảng thời gian | 🔒 admin |
| `GET` | `/logs/summarize` | Tóm tắt log user bằng AI và lưu vào DB | 🔒 admin |
| `GET` | `/logs/summarize/all` | Tóm tắt log tất cả user bằng AI (không lưu DB) | 🔒 admin |
| `GET` | `/logs/summarize/weekly/manual` | Trigger thủ công cron job tóm tắt tuần | 🔒 admin |
| `GET` | `/logs/summarize/month/manual` | Trigger thủ công cron job tóm tắt tháng | 🔒 admin |
| `GET` | `/logs/summarize/year/manual` | Trigger thủ công cron job tóm tắt năm | 🔒 admin |
| `GET` | `/logs/summaries?userId=&startDate=&endDate=` | Xem các bản tóm tắt đã lưu | 🔒 admin |
| `GET` | `/logs/report/summary?userId=&startDate=&endDate=` | Xem báo cáo tóm tắt theo userId | 🔒 admin |
| `POST` | `/logs` | Tạo bản tóm tắt log thủ công | 🔒 admin |

**Cron Jobs (tự động):**

| Schedule | Endpoint thủ công | Mô tả |
|----------|-------------------|-------|
| Mỗi tuần (`EVERY_WEEK`) | `GET /logs/summarize/weekly/manual` | Tóm tắt log tất cả user theo tuần và lưu DB |

**Cách sử dụng:**
```bash
# Tóm tắt log user bằng AI
curl "http://localhost:3000/logs/summarize?userId=<userId>&period=monthly&endDate=2025-02-10"

# Xem các bản tóm tắt đã lưu
curl "http://localhost:3000/logs/summaries?userId=<userId>&startDate=2025-01-01&endDate=2025-02-10"
```

**HTTP Status Codes:**

| Code | Khi nào | Response Body Example |
|------|---------|----------------------|
| 200 | Request thành công | `{ "success": true, "data": { "summary": "User thường xuyên tìm kiếm..." } }` |
| 400 | Thiếu userId hoặc period, period không hợp lệ (phải là daily/weekly/monthly), format date sai | `{ "success": false, "error": "Invalid period parameter", "statusCode": 400 }` |
| 404 | User không có log nào trong khoảng thời gian | `{ "success": false, "error": "No logs found for user", "statusCode": 404 }` |
| 500 | AI service error (OpenAI API error), lỗi database | `{ "success": false, "error": "Internal server error", "statusCode": 500 }` |

> **Lưu ý:**
> - Class-level `@Role('admin')`, ngoại trừ `report/activity/alls` có `@Public()`.
> - Query param `period` hỗ trợ: `daily`, `weekly`, `monthly`, `yearly`.
> - Endpoint `/summarize` sẽ **lưu kết quả vào DB** sau khi AI tóm tắt. Endpoint `/summarize/all` **không lưu**.
> - Cron job `EVERY_WEEK` tự động chạy khi server hoạt động. Mỗi lần quét tất cả userId có trong log rồi tóm tắt từng user.
> - Manual trigger cho month/year cron cũng khả dụng.
> - AI sử dụng Admin Instructions domain `log` (nếu có).

---

### 12. TrendController

**Route:** `/trends` | **Auth:** 🔒 JWT + Role `admin` | **Tag Swagger:** `Trends`

Dự đoán xu hướng nước hoa dựa trên tổng hợp log hoạt động của tất cả người dùng.

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `GET` | `/trends/summary` | Dự đoán xu hướng bằng AI (text) | 🔒 admin |
| `GET` | `/trends/summary/structured` | Dự đoán xu hướng AI có cấu trúc (JSON + metadata) | 🔒 admin |

**Cách sử dụng:**
```bash
curl -H "Authorization: Bearer <admin_token>" \
  "http://localhost:3000/trends/summary?period=monthly&endDate=2025-02-10"
```

**HTTP Status Codes:**

| Code | Khi nào | Response Body Example |
|------|---------|----------------------|
| 200 | Request thành công | `{ "success": true, "data": "Xu hướng hiện tại: người dùng ưa chuộng..." }` |
| 400 | Thiếu period hoặc endDate, period không hợp lệ (phải là daily/weekly/monthly), format date sai | `{ "success": false, "error": "Invalid period parameter", "statusCode": 400 }` |
| 404 | Không có log nào trong hệ thống để phân tích | `{ "success": false, "error": "Insufficient data for trend analysis", "statusCode": 404 }` |
| 500 | AI service error (OpenAI API error), lỗi database | `{ "success": false, "error": "Internal server error", "statusCode": 500 }` |

> **Lưu ý:**
> - **Yêu cầu role `admin`** — user thường sẽ bị 403 Forbidden.
> - Query params truyền qua URL (`period`, `endDate`), không cần request body.
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

**HTTP Status Codes:**

| Code | Khi nào | Response Body Example |
|------|---------|----------------------|
| 200 | Request thành công | `{ "success": true, "data": { "recommendations": [...], "reasoning": "..." } }` |
| 400 | Thiếu userId, period không hợp lệ (phải là daily/weekly/monthly), format date sai | `{ "success": false, "error": "Missing userId parameter", "statusCode": 400 }` |
| 404 | User không có log và không có order history | `{ "success": false, "error": "Insufficient data for recommendation", "statusCode": 404 }` |
| 500 | Backend .NET down (khi lấy orders), AI service error (OpenAI API error), lỗi database | `{ "success": false, "error": "Internal server error", "statusCode": 500 }` |

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

**HTTP Status Codes:**

| Code | Khi nào | Response Body Example |
|------|---------|----------------------|
| 200 | Request thành công | `{ "success": true, "data": "Nước hoa phù hợp cho mùa đông nên có..." }` |
| 400 | Thiếu prompt parameter | `{ "success": false, "error": "Missing prompt parameter", "statusCode": 400 }` |
| 500 | AI service error (OpenAI API error) | `{ "success": false, "error": "Internal server error", "statusCode": 500 }` |

> **Lưu ý:**
> - Endpoint này gọi thẳng `aiService.textGenerateFromPrompt` mà **không có system prompt** hay admin instruction.
> - Kết quả phụ thuộc hoàn toàn vào model AI mặc định (OpenAI GPT).
> - Phù hợp cho việc test nhanh hoặc hỏi đáp tổng quát.

---

### 15. EmailController

**Route:** `/email` | **Auth:** 🔒 JWT + Role `admin` | **Tag Swagger:** `Email`

Gửi email văn bản cơ bản thông qua NodeMailer. Dành riêng cho admin.

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `POST` | `/email/send` | Gửi email text đơn giản | 🔒 admin |

**Cách sử dụng:**
```bash
curl -X POST -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"to":"user@example.com","subject":"Thông báo","text":"Nội dung email"}' \
  http://localhost:3000/email/send
```

**HTTP Status Codes:**

| Code | Khi nào | Response Body Example |
|------|---------|----------------------|
| 200 | Gửi email thành công | `{ "success": true, "data": "Email sent successfully" }` |
| 400 | Body không hợp lệ, thiếu `to`/`subject`/`text` | `{ "success": false, "error": "Invalid request body", "statusCode": 400 }` |
| 401 | Không có token hoặc token không hợp lệ | `{ "success": false, "error": "Unauthorized", "statusCode": 401 }` |
| 403 | User không có role admin | `{ "success": false, "error": "Forbidden resource", "statusCode": 403 }` |
| 500 | Lỗi NodeMailer, SMTP config sai, mạng bị ngắt | `{ "success": false, "error": "Internal server error", "statusCode": 500 }` |

> **Lưu ý:**
> - Cần cấu hình SMTP trong `.env` để email hoạt động (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM).
> - Chỉ admin mới gửi được email — user thường sẽ bị 403 Forbidden.

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

4. **Backend .NET dependency:** Các controller Products, Orders, Inventory, Reviews, Profile đều gọi API tới backend .NET. **Cần backend .NET chạy song song** (mặc định `https://localhost:7011/api`). Một số service còn dùng **Prisma** để đọc trực tiếp từ SQL Server (không qua HTTP).

5. **Admin Instructions:** Hầu hết các endpoint AI đều hỗ trợ Admin Instructions — cho phép admin tùy chỉnh hành vi AI qua API thay vì sửa code.

6. **BullMQ Queue Endpoints (V5/V6/V7):** Các endpoint chat V5/V6/V7 và Quiz V2 sử dụng BullMQ + Redis để lưu conversation/log trong background. Yêu cầu **Redis đang chạy** (`REDIS_HOST`, `REDIS_PORT` trong `.env`). Các endpoint V1–V4 và Quiz V1 không dùng queue, vẫn hoạt động khi Redis không có.

7. **API Reference (Scalar):** Truy cập `http://localhost:3000/reference` để xem Scalar API docs với đầy đủ schema, parameters, response types. Để xác thực, tìm phần **Bearer Token** trong trang và nhập JWT token vào ô **Token** — Scalar sẽ tự động gửi kèm header `Authorization: Bearer <token>` cho tất cả request sau đó.

---

## Tóm tắt nhanh

| Bước | Lệnh / Hành động                                                      | Mô tả                                             |
| ---- | ---------------------------------------------------------------------- | ------------------------------------------------- |
| 1    | `pnpm install`                                                         | Cài đặt dependencies (dùng pnpm)                  |
| 2    | `docker run ... postgres:16`                                           | Chạy PostgreSQL (AI DB) bằng Docker               |
| 2b   | `docker run ... redis:7`                                               | Chạy Redis (BullMQ job queue) bằng Docker         |
| 3    | Tạo file `.env`                                                        | Cấu hình biến môi trường (bao gồm Redis, Prisma)  |
| 4    | `cp host-config.mjs.example host-config.mjs`                          | Cấu hình kết nối PostgreSQL cho MikroORM          |
| 5    | Copy `public_key.pem` vào thư mục gốc                                 | Cấu hình RSA public key cho JWT                   |
| 6    | `npx mikro-orm debug`                                                  | Kiểm tra kết nối PostgreSQL                       |
| 7    | `npx mikro-orm migration:up`                                           | Chạy migration tạo bảng trên PostgreSQL            |
| 8    | `pnpm run seed`                                                        | Seed dữ liệu Admin Instructions mặc định          |
| 9    | `pnpm run start:dev`                                                   | Khởi chạy server development                      |

> **Nhớ:** Cần chạy [perfume-gpt-backend](https://github.com/FPTU-ChillGuys/perfume-gpt-backend) (.NET) song song để sử dụng đầy đủ các chức năng (Product, Order, Inventory, Review, ...). SQL Server của .NET backend cũng cần chạy để Prisma kết nối được (runtime dùng `SQL_SERVER_DATABASE_*` riêng lẻ, CLI dùng `SQL_SERVER_DATABASE_URL`).
