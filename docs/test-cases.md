# 📋 Test Cases - PerfumeGPT AI Backend (SP26SE042)

> **Hệ thống quản lý bán nước hoa và tư vấn cá nhân hóa bằng trí tuệ nhân tạo**  
> Task Package 3: AI Perfume Consultation module  
> Backend API Test Cases dựa trên các Controller endpoints

---

## 📌 Tổng quan Endpoints

| # | Controller | Base Route | Số Endpoints |
|---|-----------|------------|-------------|
| 1 | ConversationController | `/conversation` | 13 |
| 2 | ProductController | `/products` | 2 |
| 3 | ReviewController | `/reviews` | 4 |
| 4 | QuizController | `/quizzes` | 6 |
| 5 | OrderController | `/orders` | 4 |
| 6 | LogController | `/logs` | 6 |
| 7 | InventoryController | `/inventory` | 5 |
| 8 | RecommendationController | `/recommendation` | 5 |
| 9 | TrendController | `/trends` | 2 |
| 10 | ProfileController | `/profile` | 2 |
| 11 | AdminInstructionController | `/admin/instructions` | 7 |
| 12 | AIAcceptanceController | `/ai-acceptance` | 4 |
| 13 | AIController | `/ai` | 1 |

---

## 🧪 1. Functional Testing (Kiểm thử chức năng)

### 1.1 Conversation Controller (`/conversation`)

| TC-ID | Endpoint | Method | Mô tả | Input | Expected Output | HTTP Code |
|-------|----------|--------|--------|-------|-----------------|-----------|
| CV-F-001 | `/conversation` | GET | Lấy tất cả cuộc hội thoại thành công | Không cần params | `{ success: true, data: [...] }` | 200 |
| CV-F-002 | `/conversation?id={id}` | GET | Lấy cuộc hội thoại theo ID hợp lệ | `id` = UUID hợp lệ có trong DB | `{ success: true, data: { id, userId, messages } }` | 200 |
| CV-F-003 | `/conversation?id={id}` | GET | Lấy cuộc hội thoại với ID không tồn tại | `id` = UUID không tồn tại | `{ success: false, error: "..." }` | 404 |
| CV-F-004 | `/conversation/list/paged` | GET | Lấy hội thoại phân trang | `page=1&pageSize=10` | `{ success: true, data: { items: [...], totalCount, page } }` | 200 |
| CV-F-005 | `/conversation/chat/v1` | POST | Chat V1 với token hợp lệ (userId từ token + profile+order) | Body: `{ messages }`, Header: `Authorization: Bearer <token>` | `{ success: true, data: { id, userId, messages } }` | 200 |
| CV-F-006 | `/conversation/chat/v1` | POST | Chat V1 không có token (guest - không lấy log) | Body: `{ messages }`, Không có header Authorization | `{ success: true, data: { id, messages } }` (không lấy log/order/profile) | 200 |
| CV-F-007 | `/conversation/chat/v2` | POST | Chat V2 với log chi tiết + token | Body: `{ messages }`, Header: `Authorization: Bearer <token>` | `{ success: true, data: { id, userId, messages } }` | 200 |
| CV-F-008 | `/conversation/chat/v3` | POST | Chat V3 dùng common helper (V1 cải thiện) | Body: `{ messages }`, Header: `Authorization: Bearer <token>` | `{ success: true, data: { id, userId, messages } }` | 200 |
| CV-F-009 | `/conversation/chat/v4` | POST | Chat V4 dùng common helper (V2 cải thiện) | Body: `{ messages }`, Header: `Authorization: Bearer <token>` | `{ success: true, data: { id, userId, messages } }` | 200 |
| CV-F-010 | `/conversation/test/v1` | POST | Test V1 với token + prompt | Header: `Authorization: Bearer <token>`, `prompt="Tìm nước hoa nam mùi gỗ"` | `{ success: true, data: "AI response text" }` | 200 |
| CV-F-011 | `/conversation/test/v2` | POST | Test V2 với token + prompt | Header: `Authorization: Bearer <token>`, `prompt="Tìm nước hoa nữ dưới 1 triệu"` | `{ success: true, data: "AI response text" }` | 200 |
| CV-F-012 | `/conversation/test/v3` | POST | Test V3 common helper | Header: `Authorization: Bearer <token>`, `prompt="Gợi ý nước hoa cho mùa hè"` | `{ success: true, data: "AI response text" }` | 200 |
| CV-F-013 | `/conversation/test/v4` | POST | Test V4 common helper | Header: `Authorization: Bearer <token>`, `prompt="Nước hoa unisex phong cách"` | `{ success: true, data: "AI response text" }` | 200 |
| CV-F-014 | `/conversation/test/guarded/v1` | POST | Test Guarded V1 - Admin only | Header: `Authorization: Bearer <admin_token>`, `prompt="test"` | `{ success: true, data: "AI response text" }` | 200 |
| CV-F-015 | `/conversation/test/guarded/v2` | POST | Test Guarded V2 - Admin only | Header: `Authorization: Bearer <admin_token>`, `prompt="test"` | `{ success: true, data: "AI response text" }` | 200 |
| CV-F-016 | `/conversation/chat/v1` | POST | Chat V1 - AI service trả về lỗi | Body hợp lệ, AI service fail | `{ success: false, error: "Failed to get AI response" }` | 200 |
| CV-F-017 | `/conversation/chat/v3` | POST | Chat V3 - Build prompt thất bại | Body hợp lệ, logService/orderService fail | `{ success: false, error: "Failed to build combined prompt" }` | 200 |

### 1.2 Product Controller (`/products`)

| TC-ID | Endpoint | Method | Mô tả | Input | Expected Output | HTTP Code |
|-------|----------|--------|--------|-------|-----------------|-----------|
| PR-F-001 | `/products` | GET | Lấy danh sách sản phẩm thành công | `page=1&pageSize=10` | `{ success: true, payload: { items: [...], totalCount } }` | 200 |
| PR-F-002 | `/products` | GET | Lấy sản phẩm với trang không tồn tại | `page=999&pageSize=10` | `{ success: true, payload: { items: [], totalCount: 0 } }` | 200 |
| PR-F-003 | `/products/search` | GET | Tìm kiếm sản phẩm semantic search | `searchText="nước hoa nam mùi gỗ dưới 2 triệu"` | `{ success: true, payload: { items: [...] } }` | 200 |
| PR-F-004 | `/products/search` | GET | Tìm kiếm sản phẩm không có kết quả | `searchText="xyz123abc"` | `{ success: true, payload: { items: [], totalCount: 0 } }` | 200 |

### 1.3 Review Controller (`/reviews`)

| TC-ID | Endpoint | Method | Mô tả | Input | Expected Output | HTTP Code |
|-------|----------|--------|--------|-------|-----------------|-----------|
| RV-F-001 | `/reviews` | GET | Lấy danh sách đánh giá phân trang | `page=1&pageSize=10` | `{ success: true, payload: { items: [...] } }` | 200 |
| RV-F-002 | `/reviews/summary/{variantId}` | GET | Tóm tắt đánh giá AI theo variant hợp lệ | `variantId` có review | `{ success: true, data: "AI summary text" }` | 200 |
| RV-F-003 | `/reviews/summary/{variantId}` | GET | Tóm tắt đánh giá variant không có review | `variantId` không có review | `{ success: true, data: "Chưa đủ dữ liệu..." }` | 200 |
| RV-F-004 | `/reviews/summary/all` | GET | Tóm tắt đánh giá tất cả variant | Không cần params | `{ success: true, data: "AI summary text" }` | 200 |
| RV-F-005 | `/reviews/summary/structured/{variantId}` | GET | Tóm tắt có cấu trúc | `variantId` hợp lệ | `{ success: true, data: { summary, variantId, reviewCount, generatedAt, metadata } }` | 200 |
| RV-F-006 | `/reviews/summary/structured/{variantId}` | GET | Tóm tắt cấu trúc - không có review | `variantId` không review | `{ success: true, data: { summary: "Chưa đủ dữ liệu...", reviewCount: 0 } }` | 200 |

### 1.4 Quiz Controller (`/quizzes`)

| TC-ID | Endpoint | Method | Mô tả | Input | Expected Output | HTTP Code |
|-------|----------|--------|--------|-------|-----------------|-----------|
| QZ-F-001 | `/quizzes/questions` | GET | Lấy danh sách câu hỏi quiz | Không cần params | `{ success: true, data: [{ id, question, answers }] }` | 200 |
| QZ-F-002 | `/quizzes/questions` | POST | Tạo câu hỏi mới | Body: `{ question: "Giới tính?", answers: [...] }` | `{ success: true, data: "..." }` | 201 |
| QZ-F-003 | `/quizzes/questions/list` | POST | Tạo nhiều câu hỏi cùng lúc | Body: `[{ question, answers }, ...]` | `{ success: true }` | 201 |
| QZ-F-004 | `/quizzes/questions/{id}` | PUT | Cập nhật câu trả lời quiz | `id` hợp lệ, Body: `[{ answer: "Nam" }]` | `{ success: true, data: { id, question, answers } }` | 200 |
| QZ-F-005 | `/quizzes/user/:userId/check-first-time` | GET | Kiểm tra user làm quiz lần đầu | `userId` chưa làm quiz | `{ success: true, data: true }` | 200 |
| QZ-F-006 | `/quizzes/user/:userId/check-first-time` | GET | User đã làm quiz trước đó | `userId` đã làm quiz | `{ success: true, data: false }` | 200 |
| QZ-F-007 | `/quizzes/user?userId={id}` | POST | Trả lời quiz và nhận gợi ý AI | `userId`, Body: `[{ questionId, answerId }]` (5 câu hỏi) | `{ success: true, data: "Top 3 nước hoa phù hợp:..." }` | 200 |
| QZ-F-008 | `/quizzes/user?userId={id}` | POST | Quiz nhưng không tìm thấy câu hỏi | `questionId` không tồn tại | `{ success: false, error: "Failed to get quiz question" }` | 200 |
| QZ-F-009 | `/quizzes/user?userId={id}` | POST | Quiz - lưu kết quả thất bại | DB lỗi khi save | `{ success: false, error: "Failed to save quiz question answers" }` | 200 |

### 1.5 Order Controller (`/orders`)

| TC-ID | Endpoint | Method | Mô tả | Input | Expected Output | HTTP Code |
|-------|----------|--------|--------|-------|-----------------|-----------|
| OD-F-001 | `/orders` | GET | Lấy tất cả đơn hàng | Header: `Authorization: Bearer <token>` | `{ success: true, payload: { items: [...] } }` | 200 |
| OD-F-002 | `/orders/user/{userId}` | GET | Lấy đơn hàng theo userId | `userId` hợp lệ, Bearer token | `{ success: true, payload: { items: [...] } }` | 200 |
| OD-F-003 | `/orders/summary/ai?userId={id}` | GET | Tóm tắt đơn hàng bằng AI | `userId` có đơn hàng | `{ success: true, data: "AI order summary text" }` | 200 |
| OD-F-004 | `/orders/summary/ai?userId={id}` | GET | Tóm tắt đơn hàng - không có order | `userId` chưa có đơn | `{ success: true, data: "Chưa đủ dữ liệu..." }` | 200 |
| OD-F-005 | `/orders/summary/ai?userId={id}` | GET | Tóm tắt đơn hàng - lấy order fail | Service lỗi | `{ success: false, error: "Failed to retrieve orders for AI summary" }` | 200 |
| OD-F-006 | `/orders/summary/ai/structured?userId={id}` | GET | Tóm tắt đơn hàng có cấu trúc | `userId` có đơn | `{ success: true, data: { summary, userId, generatedAt, metadata } }` | 200 |

### 1.6 Log Controller (`/logs`)

| TC-ID | Endpoint | Method | Mô tả | Input | Expected Output | HTTP Code |
|-------|----------|--------|--------|-------|-----------------|-----------|
| LG-F-001 | `/logs/report/activity` | GET | Lấy báo cáo log hoạt động | `userId={id}&period=MONTHLY&endDate=...` | `{ success: true, data: "report text" }` | 200 |
| LG-F-002 | `/logs/summarize` | GET | Tóm tắt log bằng AI | `userId={id}&period=MONTHLY&endDate=...` | `{ success: true, data: "AI summary" }` | 200 |
| LG-F-003 | `/logs/summarize` | GET | Tóm tắt log - không đủ dữ liệu | `userId` không có log | `{ success: true, data: "Chưa đủ dữ liệu..." }` | 200 |
| LG-F-004 | `/logs/summarize/all` | GET | Tóm tắt log tất cả users | `period=MONTHLY&endDate=...` | `{ success: true, data: "AI summary" }` | 200 |
| LG-F-005 | `/logs/summaries` | GET | Xem chi tiết bản tóm tắt | `userId={id}&startDate=...&endDate=...` | `{ success: true, data: [{ userId, summary, period }] }` | 200 |
| LG-F-006 | `/logs/report/summary` | GET | Báo cáo tóm tắt log theo userId | `userId={id}&startDate=...&endDate=...` | `{ success: true, data: "report text" }` | 200 |
| LG-F-007 | `/logs` | POST | Tạo bản tóm tắt log thủ công | Body: `{ userId, startDate, endDate, logSummary }` | `{ success: true, data: "User log summary saved successfully" }` | 201 |

### 1.7 Inventory Controller (`/inventory`)

| TC-ID | Endpoint | Method | Mô tả | Input | Expected Output | HTTP Code |
|-------|----------|--------|--------|-------|-----------------|-----------|
| IV-F-001 | `/inventory/stock` | GET | Lấy thông tin tồn kho | Header: Bearer admin token | `{ success: true, payload: { items: [...] } }` | 200 |
| IV-F-002 | `/inventory/batches` | GET | Lấy danh sách batch | Header: Bearer admin token | `{ success: true, payload: { items: [...] } }` | 200 |
| IV-F-003 | `/inventory/report` | GET | Lấy báo cáo tồn kho text | Header: Bearer admin token | `{ success: true, data: "report text" }` | 200 |
| IV-F-004 | `/inventory/report/ai` | GET | Báo cáo tồn kho bằng AI | Header: Bearer admin token | `{ success: true, data: "AI inventory report" }` | 200 |
| IV-F-005 | `/inventory/report/ai` | GET | Báo cáo AI - không đủ dữ liệu | Không có stock data | `{ success: true, data: "Chưa đủ dữ liệu..." }` | 200 |
| IV-F-006 | `/inventory/report/ai/structured` | GET | Báo cáo AI có cấu trúc | Header: Bearer admin token | `{ success: true, data: { report, generatedAt, metadata } }` | 200 |

### 1.8 Recommendation Controller (`/recommendation`)

| TC-ID | Endpoint | Method | Mô tả | Input | Expected Output | HTTP Code |
|-------|----------|--------|--------|-------|-----------------|-----------|
| RC-F-001 | `/recommendation/repurchase/v1` | POST | Gợi ý mua lại V1 (log tóm tắt) | Body: `{ userId, period, endDate }`, Bearer token | `{ success: true, data: "AI repurchase suggestion" }` | 200 |
| RC-F-002 | `/recommendation/repurchase/v2` | POST | Gợi ý mua lại V2 (log chi tiết) | Body: `{ userId, period, endDate }`, Bearer token | `{ success: true, data: "AI repurchase suggestion" }` | 200 |
| RC-F-003 | `/recommendation/repurchase/v1` | POST | Gợi ý mua lại - không đủ dữ liệu | userId không có log + order | `{ success: true, data: "Chưa đủ dữ liệu..." }` | 200 |
| RC-F-004 | `/recommendation/recommend/ai/v1` | POST | Gợi ý AI V1 (log chi tiết) | Body: `{ userId, period, endDate }` | `{ success: true, data: "AI recommendation" }` | 200 |
| RC-F-005 | `/recommendation/recommend/ai/v2` | POST | Gợi ý AI V2 (log tóm tắt) | Body: `{ userId, period, endDate }` | `{ success: true, data: "AI recommendation" }` | 200 |
| RC-F-006 | `/recommendation/recommend/ai/v1` | POST | Gợi ý AI - không đủ dữ liệu | userId không có log | `{ success: true, data: "Chưa đủ dữ liệu..." }` | 200 |
| RC-F-007 | `/recommendation/recommend/ai/structured` | POST | Gợi ý AI có cấu trúc | Body: `{ userId, period, endDate }` | `{ success: true, data: { recommendation, userId, period, metadata } }` | 200 |

### 1.9 Trend Controller (`/trends`)

| TC-ID | Endpoint | Method | Mô tả | Input | Expected Output | HTTP Code |
|-------|----------|--------|--------|-------|-----------------|-----------|
| TR-F-001 | `/trends/summary` | POST | Dự đoán xu hướng | Body: `{ period, endDate }` | `{ success: true, data: "AI trend forecast" }` | 200 |
| TR-F-002 | `/trends/summary` | POST | Xu hướng - không đủ dữ liệu | Không có log users | `{ success: true, data: "Chưa đủ dữ liệu..." }` | 200 |
| TR-F-003 | `/trends/summary/structured` | POST | Dự đoán xu hướng có cấu trúc | Body: `{ period, endDate }` | `{ success: true, data: { forecast, period, analyzedLogCount, metadata } }` | 200 |

### 1.10 Profile Controller (`/profile`)

| TC-ID | Endpoint | Method | Mô tả | Input | Expected Output | HTTP Code |
|-------|----------|--------|--------|-------|-----------------|-----------|
| PF-F-001 | `/profile/me` | GET | Lấy profile với token hợp lệ | Header: `Authorization: Bearer <user_token>` | `{ success: true, payload: { id, name, email, ... } }` | 200 |
| PF-F-002 | `/profile/me` | GET | Lấy profile không có token | Không header | `{ success: false, error: "..." }` | 401 |
| PF-F-003 | `/profile/report` | GET | Tạo báo cáo profile text | Header: `Authorization: Bearer <user_token>` | `{ success: true, data: "profile report text" }` | 200 |
| PF-F-004 | `/profile/report` | GET | Báo cáo profile - fetch fail | Token hết hạn / không hợp lệ | `{ success: false, error: "Failed to fetch profile" }` | 200 |

### 1.11 Admin Instruction Controller (`/admin/instructions`)

| TC-ID | Endpoint | Method | Mô tả | Input | Expected Output | HTTP Code |
|-------|----------|--------|--------|-------|-----------------|-----------|
| AI-F-001 | `/admin/instructions` | GET | Lấy tất cả instructions (admin) | Header: Bearer admin token | `{ success: true, data: [...] }` | 200 |
| AI-F-002 | `/admin/instructions/{id}` | GET | Lấy instruction theo ID | `id` hợp lệ | `{ success: true, data: { id, instruction, instructionType } }` | 200 |
| AI-F-003 | `/admin/instructions/{id}` | GET | Lấy instruction ID không tồn tại | UUID không tồn tại | `{ success: false, error: "..." }` | 404 |
| AI-F-004 | `/admin/instructions/type/{type}` | GET | Lấy instructions theo loại | `type=review` | `{ success: true, data: [...] }` | 200 |
| AI-F-005 | `/admin/instructions/combined/{type}` | GET | Gộp instructions thành prompt | `type=conversation` | `{ success: true, data: "combined prompt text" }` | 200 |
| AI-F-006 | `/admin/instructions` | POST | Tạo instruction mới | Body: `{ instruction: "...", instructionType: "review" }` | `{ success: true, data: { id, instruction, instructionType } }` | 201 |
| AI-F-007 | `/admin/instructions/{id}` | PUT | Cập nhật instruction | `id` + Body: `{ instruction: "updated text" }` | `{ success: true, data: { id, instruction } }` | 200 |
| AI-F-008 | `/admin/instructions/{id}` | DELETE | Xóa instruction | `id` hợp lệ | `{ success: true, data: true }` | 200 |

### 1.12 AI Acceptance Controller (`/ai-acceptance`)

| TC-ID | Endpoint | Method | Mô tả | Input | Expected Output | HTTP Code |
|-------|----------|--------|--------|-------|-----------------|-----------|
| AA-F-001 | `/ai-acceptance/{id}?status=true` | POST | Cập nhật trạng thái chấp nhận | `id` + `status=true` | `{ success: true, data: { id, isAccepted: true } }` | 200 |
| AA-F-002 | `/ai-acceptance/status/{userId}` | GET | Lấy trạng thái AI acceptance | `userId` hợp lệ | `{ success: true, data: { userId, isAccepted } }` | 200 |
| AA-F-003 | `/ai-acceptance/rate?isAccepted=true` | GET | Tỷ lệ chấp nhận AI (accepted) | `isAccepted=true` | `{ success: true, data: 0.75 }` (ví dụ 75%) | 200 |
| AA-F-004 | `/ai-acceptance/rate/{userId}` | GET | Tỷ lệ chấp nhận AI theo user | `userId` hợp lệ | `{ success: true, data: 0.80 }` | 200 |
| AA-F-005 | `/ai-acceptance/record/{userId}?isAccepted=true` | POST | Tạo bản ghi acceptance mới | `userId` + `isAccepted=true` | `{ success: true, data: { id, userId, isAccepted } }` | 201 |

### 1.13 AI Controller (`/ai`)

| TC-ID | Endpoint | Method | Mô tả | Input | Expected Output | HTTP Code |
|-------|----------|--------|--------|-------|-----------------|-----------|
| AC-F-001 | `/ai/search?prompt=...` | POST | Tìm kiếm sản phẩm bằng AI | `prompt="nước hoa nam phong cách"` | `{ success: true, data: "AI search result" }` | 200 |
| AC-F-002 | `/ai/search?prompt=...` | POST | AI search - service lỗi | AI service fail | `{ success: false, error: "Failed to get AI response" }` | 200 |

---

## 📊 2. Test dữ liệu & Xác thực dữ liệu (Data Validation)

### 2.1 Request Body Validation

| TC-ID | Endpoint | Mô tả | Input sai | Expected | HTTP Code |
|-------|----------|--------|-----------|----------|-----------|
| DV-001 | `POST /conversation/chat/v1` | Guest (không có token) | `{ messages: [...] }` (không có token) | Chat hoạt động bình thường, không lấy log/order/profile | 200 |
| DV-002 | `POST /conversation/chat/v1` | Messages rỗng | `{ messages: [] }`, Header: `Authorization: Bearer <token>` | Xử lý bình thường hoặc trả lỗi | 200/400 |
| DV-003 | `POST /conversation/chat/v1` | Token không hợp lệ | `{ messages: [...] }`, Invalid token | Xử lý gracefully - không crash, chat như guest | 200 |
| DV-004 | `POST /quizzes/user?userId={id}` | Body không đúng format array | `{ questionId: "...", answerId: "..." }` (object thay vì array) | Validation error | 400 |
| DV-005 | `POST /quizzes/user?userId={id}` | Array rỗng | `[]` | Trả response rỗng hoặc lỗi | 400 |
| DV-006 | `POST /quizzes/questions` | Thiếu trường question | `{ answers: [...] }` | Validation error | 400 |
| DV-007 | `POST /recommendation/repurchase/v1` | Thiếu userId | `{ period: "MONTHLY", endDate: "..." }` | Validation error | 400 |
| DV-008 | `POST /trends/summary` | Period không hợp lệ | `{ period: "YEARLY" }` (nếu không support) | Validation error hoặc default | 400 |
| DV-009 | `POST /admin/instructions` | Body rỗng | `{}` | Validation error | 400 |
| DV-010 | `POST /admin/instructions` | instruction quá dài (>10000 ký tự) | text rất dài | Xử lý bình thường (cột text không giới hạn) | 200 |
| DV-011 | `POST /logs` | Thiếu trường bắt buộc | `{ userId: "abc" }` (thiếu startDate, endDate, logSummary) | Validation error | 400 |

### 2.2 Query Parameter Validation

| TC-ID | Endpoint | Mô tả | Input sai | Expected | HTTP Code |
|-------|----------|--------|-----------|----------|-----------|
| DV-020 | `GET /logs/summarize` | userId rỗng | `userId=&period=MONTHLY` | Error hoặc empty response | 400 |
| DV-021 | `GET /orders/summary/ai` | userId không phải UUID | `userId=invalid-not-uuid` | Xử lý gracefully | 200/400 |
| DV-022 | `GET /reviews/summary/{variantId}` | variantId rỗng string | `/reviews/summary/` | Route not found | 404 |
| DV-023 | `GET /products/search` | searchText rỗng | `searchText=` | Trả kết quả mặc định hoặc error | 200/400 |
| DV-024 | `GET /ai-acceptance/rate` | isAccepted không phải boolean string | `isAccepted=maybe` | Xử lý = false | 200 |
| DV-025 | `GET /conversation/list/paged` | page âm | `page=-1&pageSize=10` | Validation error hoặc default page 1 | 400/200 |
| DV-026 | `GET /conversation/list/paged` | pageSize = 0 | `page=1&pageSize=0` | Validation error hoặc default | 400/200 |
| DV-027 | `GET /logs/summaries` | endDate trước startDate | `startDate=2026-02-01&endDate=2025-01-01` | Empty result hoặc error | 200/400 |

### 2.3 Response Schema Validation

| TC-ID | Endpoint | Mô tả | Kiểm tra |
|-------|----------|--------|----------|
| DV-030 | Tất cả endpoints | Response luôn có trường `success` | `typeof response.success === "boolean"` |
| DV-031 | Tất cả endpoints thất bại | Response lỗi có trường `error` | `response.error !== undefined` khi `success === false` |
| DV-032 | Tất cả endpoints thành công | Response thành công có trường `data` hoặc `payload` | `response.data !== undefined || response.payload !== undefined` khi `success === true` |
| DV-033 | Structured endpoints | Metadata có processingTimeMs | `response.data.metadata.processingTimeMs >= 0` |
| DV-034 | Structured endpoints | generatedAt là ISO date string hợp lệ | `new Date(response.data.generatedAt)` valid |
| DV-035 | Paged endpoints | items là array, totalCount >= 0 | `Array.isArray(items)` và `totalCount >= 0` |

---

## 🚀 3. Performance & Load Testing (Hiệu năng / Tải)

### 3.1 Response Time Requirements

| TC-ID | Endpoint | Yêu cầu NFR | Mô tả kiểm tra |
|-------|----------|-------------|-----------------|
| PF-001 | `GET /products` | < 3 giây | Lấy danh sách sản phẩm phân trang |
| PF-002 | `GET /products/search` | < 3 giây | Semantic search sản phẩm |
| PF-003 | `POST /conversation/chat/v3` | < 5 giây | AI consultation response time |
| PF-004 | `POST /quizzes/user` | < 5 giây | Quiz → AI recommendation |
| PF-005 | `GET /reviews/summary/{id}` | < 5 giây | AI review summarization |
| PF-006 | `GET /orders/summary/ai` | < 5 giây | AI order summary |
| PF-007 | `POST /recommendation/recommend/ai/v1` | < 5 giây | AI recommendation |
| PF-008 | `POST /trends/summary` | < 10 giây | Trend forecasting (nhiều data) |
| PF-009 | `GET /inventory/report/ai` | < 5 giây | AI inventory report |
| PF-010 | `GET /conversation` | < 3 giây | Lấy tất cả conversations |

### 3.2 Load Testing Scenarios

| TC-ID | Scenario | Mô tả | Điều kiện | Expected |
|-------|----------|--------|-----------|----------|
| LT-001 | Concurrent Chat | 50 users đồng thời gửi chat/v3 | 50 concurrent POST requests | Tất cả trả response < 10s, không 500 |
| LT-002 | Product Search Spike | 100 users tìm kiếm sản phẩm | 100 concurrent GET /products/search | Response < 5s, no timeout |
| LT-003 | Quiz Rush | 30 users đồng thời làm quiz | 30 concurrent POST /quizzes/user | Tất cả save thành công, AI respond |
| LT-004 | AI Endpoints Under Load | 20 concurrent AI summary requests | GET /reviews/summary, /orders/summary/ai, /inventory/report/ai | Không crash, queue gracefully |
| LT-005 | Database Connection Pool | 100 concurrent DB read operations | GET /conversation, /products, /reviews | Connection pool không exhausted |
| LT-006 | Mixed Load | 50 chat + 50 search + 20 quiz | Kết hợp endpoints | 99.9% success rate |

### 3.3 Stress Testing

| TC-ID | Scenario | Mô tả | Expected |
|-------|----------|--------|----------|
| ST-001 | AI API Rate Limit | Gửi 100 AI requests liên tục | Graceful handling, queue hoặc retry |
| ST-002 | Large Message History | Chat với 100+ messages trong conversation | Không timeout, response vẫn đúng |
| ST-003 | Large Review Set | Summarize 500+ reviews cho 1 variant | AI vẫn trả response, có thể chậm hơn |

---

## 🔒 4. Security Testing (Bảo mật)

### 4.1 Authentication & Authorization

| TC-ID | Endpoint | Mô tả | Input | Expected | HTTP Code |
|-------|----------|--------|-------|----------|-----------|
| SC-001 | `GET /admin/instructions` | Truy cập admin endpoint không có token | Không header Authorization | Unauthorized | 401 |
| SC-002 | `GET /admin/instructions` | Truy cập admin endpoint với user token (không phải admin) | Bearer: customer token | Forbidden | 403 |
| SC-003 | `GET /admin/instructions` | Truy cập admin endpoint với admin token | Bearer: admin token | `{ success: true, data: [...] }` | 200 |
| SC-004 | `POST /admin/instructions` | Tạo instruction với role customer | Bearer: customer token | Forbidden | 403 |
| SC-005 | `PUT /admin/instructions/{id}` | Cập nhật instruction với role customer | Bearer: customer token | Forbidden | 403 |
| SC-006 | `DELETE /admin/instructions/{id}` | Xóa instruction với role customer | Bearer: customer token | Forbidden | 403 |
| SC-007 | `GET /inventory/stock` | Truy cập inventory không có token | Không header | Unauthorized | 401 |
| SC-008 | `GET /inventory/stock` | Truy cập inventory với customer token | Bearer: customer token | Forbidden | 403 |
| SC-009 | `POST /conversation/test/guarded/v1` | Guarded test không có token | Không header | Unauthorized | 401 |
| SC-010 | `POST /conversation/test/guarded/v1` | Guarded test với customer token | Bearer: customer token | Forbidden | 403 |
| SC-011 | `POST /conversation/test/guarded/v1` | Guarded test với admin token | Bearer: admin token | `{ success: true }` | 200 |
| SC-012 | `POST /conversation/chat/v1` | Public endpoint hoạt động không cần token | Không header, Body hợp lệ | `{ success: true }` (chỉ dùng user log) | 200 |

### 4.2 Token Security

| TC-ID | Mô tả | Input | Expected | HTTP Code |
|-------|--------|-------|----------|-----------|
| SC-020 | Token hết hạn | Bearer: expired JWT | Unauthorized | 401 |
| SC-021 | Token sai format | `Authorization: Bearer abc123invalid` | Unauthorized | 401 |
| SC-022 | Token bị tampered (modified payload) | JWT với payload bị sửa | Unauthorized | 401 |
| SC-023 | Không có "Bearer" prefix | `Authorization: <token>` | Unauthorized | 401 |
| SC-024 | Token rỗng | `Authorization: Bearer ` | Unauthorized | 401 |

### 4.3 Input Injection

| TC-ID | Endpoint | Mô tả | Input | Expected |
|-------|----------|--------|-------|----------|
| SC-030 | `POST /ai/search` | SQL injection trong prompt | `prompt="'; DROP TABLE conversation; --"` | AI xử lý text bình thường, DB không bị ảnh hưởng |
| SC-031 | `POST /conversation/chat/v1` | XSS trong message | `message: "<script>alert('xss')</script>"` | Text được escape hoặc AI xử lý như text |
| SC-032 | `GET /products/search` | NoSQL injection | `searchText={"$gt": ""}` | Xử lý như plain text |
| SC-033 | `POST /admin/instructions` | HTML injection trong instruction | `instruction: "<img onerror=alert(1)>"` | Lưu dưới dạng text, không execute |
| SC-034 | `GET /reviews/summary/{variantId}` | Path traversal | `variantId=../../../etc/passwd` | 404 hoặc invalid ID error |

### 4.4 Data Protection

| TC-ID | Mô tả | Kiểm tra |
|-------|--------|----------|
| SC-040 | API không trả về sensitive data trong error message | Error response không chứa stack trace, DB credentials |
| SC-041 | Admin instructions không expose cho non-admin | `GET /admin/instructions` chỉ trả cho admin role |
| SC-042 | Profile data chỉ trả cho chính user đó | `GET /profile/me` trả profile của token owner, không ai khác |
| SC-043 | CORS configuration đúng | Chỉ accept requests từ allowed origins |

---

## 🔄 5. Integration Testing (Kiểm thử tích hợp)

### 5.1 Database Integration

| TC-ID | Mô tả | Kiểm tra | Expected |
|-------|--------|----------|----------|
| IT-001 | Chat tạo conversation mới trong DB | POST /conversation/chat/v3 với token hợp lệ → kiểm tra DB | Record mới trong bảng `conversation` + `message` |
| IT-002 | Chat cập nhật conversation có sẵn | POST /conversation/chat/v3 với conversationId có sẵn | Messages được append, không tạo duplicate |
| IT-003 | Quiz lưu kết quả vào DB | POST /quizzes/user → kiểm tra bảng `quiz_question_answer` | Record mới với userId, questionId, answerId |
| IT-004 | Quiz tạo user log entry | POST /quizzes/user → kiểm tra user_log | Quiz log entry created |
| IT-005 | Log summary lưu vào DB | GET /logs/summarize → kiểm tra bảng `user_log_summary` | Summary record saved |
| IT-006 | Admin instruction CRUD | POST → GET → PUT → DELETE instruction | Dữ liệu nhất quán qua CRUD operations |
| IT-007 | AI acceptance record persist | POST /ai-acceptance/record/{userId} → GET /ai-acceptance/status/{userId} | Status khớp với record vừa tạo |

### 5.2 External API Integration (Order, Product, Profile services)

| TC-ID | Mô tả | Kiểm tra | Expected |
|-------|--------|----------|----------|
| IT-010 | Order service đồng bộ | GET /orders với token → so sánh với order service gốc | Dữ liệu khớp |
| IT-011 | Product service đồng bộ | GET /products → so sánh với product catalog | Dữ liệu khớp |
| IT-012 | Profile service integration | GET /profile/me → so sánh với auth service | Profile data đúng |
| IT-013 | Order service unreachable | Service down → GET /orders | Error message rõ ràng, không crash |
| IT-014 | Profile service unreachable | Service down → GET /profile/me | `{ success: false, error }`, không crash |

### 5.3 OpenAI API Integration

| TC-ID | Mô tả | Kiểm tra | Expected |
|-------|--------|----------|----------|
| IT-020 | AI response quality | POST /conversation/chat/v3 với prompt nước hoa | Trả về sản phẩm liên quan, reasoning hợp lý |
| IT-021 | AI xử lý tiếng Việt | Prompt tiếng Việt → response tiếng Việt | Đúng ngôn ngữ |
| IT-022 | AI xử lý tiếng Anh | Prompt tiếng Anh → response tiếng Anh | Đúng ngôn ngữ |
| IT-023 | Admin instruction ảnh hưởng AI output | Thay đổi instruction → gọi lại API | Response theo hướng instruction mới |
| IT-024 | AI API timeout | OpenAI API chậm > 30s | Graceful timeout, error message |
| IT-025 | AI API downtime | OpenAI API hoàn toàn down | `{ success: false, error }`, không crash server |

### 5.4 End-to-End Flow Tests

| TC-ID | Flow | Các bước | Expected |
|-------|------|---------|----------|
| IT-030 | Quiz → Recommendation | 1. GET /quizzes/questions 2. POST /quizzes/user 3. POST /recommendation/recommend/ai/v1 | Quiz result ảnh hưởng recommendation |
| IT-031 | Chat → Review → Repurchase | 1. POST /conversation/chat/v3 2. GET /reviews/summary/{id} 3. POST /recommendation/repurchase/v2 | Dữ liệu nhất quán xuyên suốt |
| IT-032 | Admin Instruction → AI Response | 1. POST /admin/instructions (instruction mới) 2. POST /conversation/chat/v3 | AI response phản ánh instruction |
| IT-033 | Profile → Chat Personalization | 1. GET /profile/me 2. POST /conversation/chat/v3 (cùng token) | Chat response dùng profile data |

---

## 💡 6. Negative Testing

### 6.1 Invalid/Missing Input

| TC-ID | Endpoint | Mô tả | Input | Expected | HTTP Code |
|-------|----------|--------|-------|----------|-----------|
| NT-001 | `POST /conversation/chat/v1` | Body hoàn toàn rỗng | `{}` | Xử lý gracefully, không crash | 400/200 |
| NT-002 | `POST /conversation/chat/v1` | Content-Type sai | `Content-Type: text/plain`, body text | 400 hoặc parse error | 400 |
| NT-003 | `POST /quizzes/user` | questionId không match answerId | Sai mapping câu hỏi-trả lời | `{ success: false, error }` | 200 |
| NT-004 | `PUT /quizzes/questions/{id}` | ID không tồn tại | UUID không có trong DB | `{ success: false, error }` | 404 |
| NT-005 | `DELETE /admin/instructions/{id}` | Xóa đã bị xóa | ID đã bị delete trước đó | `{ success: false, error }` | 404 |
| NT-006 | `GET /orders/user/{userId}` | userId = null | `/orders/user/null` | Error response, không crash | 400 |
| NT-007 | `POST /recommendation/repurchase/v1` | startDate trong tương lai | `startDate: "2030-01-01"` | Empty logs, "chưa đủ dữ liệu" | 200 |
| NT-008 | `POST /conversation/chat/v1` | messages chứa >1000 tin nhắn | Array rất lớn | Timeout hoặc xử lý, không OOM | 200/408 |
| NT-009 | `POST /ai/search` | prompt rỗng | `prompt=""` | Error hoặc AI default response | 200/400 |
| NT-010 | `POST /admin/instructions` | instructionType rỗng | `{ instruction: "text", instructionType: "" }` | Validation error | 400 |

### 6.2 Server Error Handling

| TC-ID | Scenario | Mô tả | Expected |
|-------|----------|--------|----------|
| NT-020 | Database unreachable | DB connection lost mid-request | 500 + `{ success: false, error }`, không leak credentials |
| NT-021 | OpenAI API key invalid | Sai API key | `{ success: false, error: "Failed to get AI response" }` |
| NT-022 | Memory pressure | Large batch operations | Graceful degradation, không crash |
| NT-023 | Concurrent write conflict | 2 users update cùng conversation | Một thành công, một retry hoặc error |

### 6.3 Boundary Testing

| TC-ID | Mô tả | Input | Expected |
|-------|--------|-------|----------|
| NT-030 | Prompt cực dài (>10000 chars) | `prompt` = 10000+ characters | AI xử lý hoặc truncate, không crash |
| NT-031 | userId = chuỗi đặc biệt | `userId = "!@#$%^&*()"` | Validation error hoặc graceful |
| NT-032 | pageSize cực lớn | `pageSize=999999` | Giới hạn hoặc trả tất cả, không OOM |
| NT-033 | Unicode prompt | `prompt = "🌸🌺 nước hoa thơm 🌹"` | AI xử lý unicode bình thường |
| NT-034 | Empty database | Tất cả bảng trống | Các endpoint trả empty arrays, "chưa đủ dữ liệu" |

---

## 📦 7. Regression Testing

### 7.1 Core Feature Regression Checklist

| TC-ID | Feature | Test cần chạy lại khi thay đổi | Endpoints ảnh hưởng |
|-------|---------|-------------------------------|---------------------|
| RG-001 | AI Prompt System | Thay đổi prompt constants | Tất cả AI endpoints (chat, quiz, review, order, inventory, recommendation, trend) |
| RG-002 | Admin Instructions | Thay đổi admin instruction logic | Tất cả AI endpoints (admin instruction inject vào AI prompt) |
| RG-003 | User Log Service | Thay đổi log collection/summary | chat/v1-v4, test/v1-v4, recommendation, trend, logs |
| RG-004 | Order Service Integration | Thay đổi order API integration | chat/v1-v4, orders, recommendation/repurchase |
| RG-005 | Profile Service | Thay đổi profile fetching | chat/v1-v4, profile |
| RG-006 | Authentication/Guard | Thay đổi auth logic | Tất cả guarded endpoints, admin endpoints, inventory |
| RG-007 | Database Schema | Migration mới | Tất cả CRUD operations |
| RG-008 | Conversation CRUD | Thay đổi save/update logic | conversation/chat/v1-v4 |
| RG-009 | Quiz Flow | Thay đổi quiz logic | quizzes/* endpoints |
| RG-010 | Common Helper (chat-prompt-builder) | Thay đổi buildCombinedPromptV1/V2 | chat/v3-v4, test/v3-v4, guarded/v1-v2 |

### 7.2 Smoke Test Suite (chạy sau mỗi deploy)

| Order | TC-ID | Endpoint | Mô tả |
|-------|-------|----------|--------|
| 1 | SM-001 | `GET /products` | Kiểm tra server sống, DB kết nối |
| 2 | SM-002 | `GET /products/search?searchText=nước hoa` | Kiểm tra search hoạt động |
| 3 | SM-003 | `GET /quizzes/questions` | Kiểm tra quiz data tồn tại |
| 4 | SM-004 | `POST /conversation/test/v3?prompt=hello` (với Bearer token) | Kiểm tra AI service hoạt động |
| 5 | SM-005 | `GET /reviews` | Kiểm tra review listing |
| 6 | SM-006 | `GET /admin/instructions` (admin token) | Kiểm tra admin auth + instructions |
| 7 | SM-007 | `GET /ai-acceptance/rate?isAccepted=true` | Kiểm tra acceptance tracking |
| 8 | SM-008 | `GET /profile/me` (user token) | Kiểm tra profile service integration |

---

## 📊 Tổng hợp Test Cases

| Loại Test | Số lượng TCs | Priority |
|-----------|-------------|----------|
| 🧪 Functional Testing | 75 | P1 - Critical |
| 📊 Data Validation | 32 | P1 - Critical |
| 🚀 Performance Testing | 16 | P2 - High |
| 🔒 Security Testing | 21 | P1 - Critical |
| 🔄 Integration Testing | 21 | P2 - High |
| 💡 Negative Testing | 17 | P2 - High |
| 📦 Regression Testing | 18 | P3 - Medium |
| **Tổng cộng** | **200** | |

---

## 🛠️ Tools đề xuất

| Tool | Mục đích |
|------|---------|
| **Postman** | Functional testing, data validation, manual API testing |
| **Jest + Supertest** | Unit/integration test trong NestJS |
| **k6 / Artillery** | Load & performance testing |
| **OWASP ZAP** | Security scanning |
| **Newman** | Automation cho Postman collections (CI/CD) |

---

> **Ghi chú:** Tất cả test cases dựa trên cấu trúc response `{ success: boolean, data?: T, error?: string }` của BaseResponse. Các endpoint dùng BaseResponseAPI có thêm trường `payload` thay vì `data`.
