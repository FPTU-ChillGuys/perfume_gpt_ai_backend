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
