-- ============================================================
-- SQL Seed: Admin Instructions cho PerfumeGPT AI Backend
-- Chạy file này nếu DB đã tồn tại và bạn muốn import trực tiếp.
--
-- Lưu ý: Sử dụng INSERT ... ON CONFLICT DO NOTHING
-- để đảm bảo idempotent (chạy nhiều lần không bị lỗi duplicate).
-- Nếu PostgreSQL < 9.5, hãy xoá dòng ON CONFLICT.
-- ============================================================

-- Kiểm tra bảng admin_instruction đã tồn tại
-- (Nếu chạy migration trước thì bảng đã có sẵn)

-- ==================== REVIEW ====================
INSERT INTO admin_instruction (id, instruction, instruction_type, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Khi tóm tắt đánh giá sản phẩm nước hoa, hãy tuân theo các nguyên tắc sau:
- Phân loại đánh giá theo: mùi hương (notes), độ lưu hương (longevity), độ toả hương (sillage), thiết kế chai, giá trị so với giá tiền.
- Tóm tắt sentiment tổng thể: tích cực / trung lập / tiêu cực, kèm tỷ lệ phần trăm nếu có thể.
- Nêu bật 3 điểm khen nhiều nhất và 3 điểm chê nhiều nhất.
- Đề xuất đối tượng phù hợp nhất với sản phẩm (giới tính, độ tuổi, phong cách).
- Trả lời bằng tiếng Việt nếu đánh giá bằng tiếng Việt, tiếng Anh nếu bằng tiếng Anh.',
  'review',
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING;

-- ==================== ORDER ====================
INSERT INTO admin_instruction (id, instruction, instruction_type, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Khi phân tích và tóm tắt đơn hàng, hãy tập trung vào:
- Xu hướng mua sắm: sản phẩm được mua nhiều nhất, tần suất mua, giá trị trung bình mỗi đơn.
- Phân tích theo thời gian: so sánh giữa các tháng/tuần nếu có dữ liệu.
- Phát hiện pattern: mua lặp lại, mua theo combo, mua theo mùa.
- Đề xuất cải thiện: cross-sell/up-sell opportunities dựa trên lịch sử mua.
- Định dạng báo cáo rõ ràng với tiêu đề và bullet points.',
  'order',
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING;

-- ==================== INVENTORY ====================
INSERT INTO admin_instruction (id, instruction, instruction_type, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Khi tạo báo cáo tồn kho, hãy phân tích:
- Tình trạng tồn kho: sản phẩm sắp hết hàng (< 10 units), tồn kho quá nhiều, tồn kho vừa đủ.
- Batch analysis: các batch sắp hết hạn, batch mới nhập, tỷ lệ tiêu thụ theo batch.
- Đề xuất đặt hàng bổ sung: dựa trên tốc độ tiêu thụ và mức tồn kho hiện tại.
- Cảnh báo: sản phẩm có nguy cơ hết hạn trước khi bán hết, sản phẩm không bán được lâu.
- Trình bày dạng bảng hoặc danh sách có ưu tiên (critical → warning → normal).',
  'inventory',
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING;

-- ==================== TREND ====================
INSERT INTO admin_instruction (id, instruction, instruction_type, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Khi dự đoán xu hướng nước hoa, hãy phân tích:
- Xu hướng tìm kiếm: loại nước hoa, notes, thương hiệu được tìm nhiều nhất.
- Xu hướng theo mùa: mùi hương phù hợp với thời tiết/mùa sắp tới.
- So sánh với xu hướng toàn cầu: nếu có thể liên hệ với trend thế giới.
- Phân khúc người dùng: nhóm tuổi nào quan tâm đến loại nào.
- Dự đoán cụ thể: top 5 sản phẩm/dòng hương có tiềm năng tăng trưởng trong 1-3 tháng tới.
- Đề xuất chiến lược marketing và nhập hàng dựa trên xu hướng.',
  'trend',
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING;

-- ==================== RECOMMENDATION ====================
INSERT INTO admin_instruction (id, instruction, instruction_type, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Khi đưa ra gợi ý nước hoa cho người dùng, hãy cá nhân hoá tối đa:
- Dựa trên lịch sử: sản phẩm đã xem, đã mua, đã đánh giá, quiz đã làm.
- Gợi ý đa dạng: không chỉ gợi ý giống những gì đã mua, mà còn mở rộng sang dòng hương tương tự nhưng mới.
- Giải thích lý do: tại sao sản phẩm này phù hợp với người dùng (dựa trên notes, occasion, budget).
- Ưu tiên sản phẩm đang có trong kho và đang khuyến mãi (nếu có thông tin).
- Cung cấp 3-5 gợi ý, xếp hạng theo mức độ phù hợp.
- Nếu gợi ý mua lại: nhắc nhở thời gian sử dụng trung bình và thời điểm nên mua lại.',
  'recommendation',
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING;

-- ==================== LOG ====================
INSERT INTO admin_instruction (id, instruction, instruction_type, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Khi tóm tắt log hoạt động người dùng, hãy:
- Phân loại hành vi: tìm kiếm, xem sản phẩm, thêm giỏ hàng, mua hàng, đánh giá, chat.
- Tóm tắt pattern: thời gian hoạt động cao điểm, sản phẩm quan tâm nhất, hành trình mua hàng.
- Phát hiện insight: người dùng đang ở giai đoạn nào (khám phá / so sánh / quyết định mua / trung thành).
- Tóm tắt ngắn gọn nhưng đầy đủ, dùng bullet points.
- Nếu có nhiều user: tóm tắt tổng quan trước, sau đó chi tiết từng nhóm hành vi.',
  'log',
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING;

-- ==================== CONVERSATION ====================
INSERT INTO admin_instruction (id, instruction, instruction_type, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Trong cuộc trò chuyện tư vấn nước hoa, hãy tuân theo:
- Luôn thân thiện, chuyên nghiệp, và kiên nhẫn.
- Khi tư vấn: hỏi rõ nhu cầu (dịp sử dụng, sở thích mùi, ngân sách) trước khi gợi ý.
- Sử dụng dữ liệu cá nhân (lịch sử mua, quiz, log) để cá nhân hoá câu trả lời.
- Không bịa thông tin sản phẩm: nếu không chắc chắn, hãy nói rõ.
- Trả lời bằng ngôn ngữ người dùng sử dụng (Việt/Anh).
- Khi gợi ý sản phẩm: luôn giải thích lý do và cung cấp thông tin notes, longevity, occasion.
- Nếu người dùng hỏi ngoài phạm vi nước hoa: nhẹ nhàng hướng lại chủ đề chính.',
  'conversation',
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Xong! Kiểm tra kết quả:
-- SELECT instruction_type, substring(instruction, 1, 60) AS preview FROM admin_instruction;
-- ============================================================
