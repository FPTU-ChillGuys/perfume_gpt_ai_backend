# Fix: AI Normalization Bịa Từ Không Có Trong Context

## Vấn Đề

**Triệu chứng**: Khi user search với keyword như "Fruity", hệ thống trả về các kết quả không liên quan như "Dứa", "Quả lê" mặc dù các từ này không có trong context ban đầu.

**Nguyên nhân**: 
- `INTERNAL_NORMALIZATION_SYSTEM_PROMPT` cũ không có cơ chế kiểm tra xem từ chuẩn có THẬT SỰ tồn tại trong context không.
- AI được yêu cầu "Hỗ trợ 1-nhiều" nên nó tự động trả về TẤT CẢ các từ liên quan, kể cả những từ không cần thiết.

## Giải Pháp

### 1. Cập nhật Prompt (ĐÃ FIX)

**File**: `src/application/constant/prompts/system.prompt.ts`

**Thay đổi**:
- Thêm quy tắc **KHÔNG BỊA TỪ MỚI**: Chỉ trả về các giá trị CHUẨN có THẬT SỰ trong DANH MỤC CHUẨN (CONTEXT).
- Thêm quy tắc **KIỂM TRA CONTEXT TRƯỚC KHI TRẢ VỀ**: Nếu giá trị không có trong context → BỎ qua.
- Thêm quy tắc **HỖ TRỢ 1-NHIỀU CHỈ KHI THẬT SỰ CẦN THIẾT**: Không trả về quá nhiều giá trị không liên quan.

**Prompt mới**:
```typescript
export const INTERNAL_NORMALIZATION_SYSTEM_PROMPT = `
## QUY TẮC BẮT BUỘC (CRITICAL):
1. **KHÔNG BỊA TỪ MỚI**: Chỉ trả về các giá trị CHUẨN có THẬT SỰ trong DANH MỤC CHUẨN (CONTEXT).
   - KHÔNG được tự tạo ra từ mới không có trong context.
   - Ví dụ: Nếu context không có "Dứa", "Quả lê" thì KHÔNG được trả về các từ này.

2. **CHỈ CHUẨN HÓA KHI CÓ ĐỒNG NGHĨA RÕ RÀNG**:
   - Từ khóa của người dùng phải có ĐỒNG NGHĨA hoặc KHÚC NGỮ NGHĨA RÕ RÀNG với một giá trị trong context.
   - Nếu không có đồng nghĩa rõ ràng → trả về null.

3. **HỖ TRỢ 1-NHIỀU CHỈ KHI THẬT SỰ CẦN THIẾT**:
   - Chỉ trả về nhiều giá trị nếu từ khóa của người dùng THẬT SỰ bao hàm nhiều danh mục.
   - KHÔNG trả về quá nhiều giá trị không liên quan.

4. **KIỂM TRA CONTEXT TRƯỚC KHI TRẢ VỀ**:
   - Trước khi trả về một giá trị, PHẢI kiểm tra xem nó có THẬT SỰ tồn tại trong DANH MỤC CHUẨN không.
   - Nếu giá trị không có trong context → BỎ qua, không trả về.
`;
```

### 2. Kiểm Tra Sau Khi Fix

**Log mong đợi sau khi fix**:
```
[Nest] ... LOG [MasterDataTool] [searchMasterData] searchInfos: [{"keyword":"Fruity","types":["note"]}]
[Nest] ... LOG [MasterDataTool] [searchMasterData] Re-searching normalized: Fruity -> Trái cây (nếu có trong context)
// KHÔNG có log: "Re-searching normalized: Fruity -> Dứa" (vì Dứa không có trong context)
```

**Kết quả**:
- ✅ Chỉ trả về các từ chuẩn THẬT SỰ có trong context
- ✅ Không bịa ra từ mới
- ✅ Không trả về quá nhiều kết quả không liên quan

## Testing

### Test Case 1: Keyword có đồng nghĩa trong context
```
Input: "Fruity"
Context: Có "Trái cây", "Quả táo"
Expected: Trả về ["Trái cây"] (nếu có)
```

### Test Case 2: Keyword không có đồng nghĩa trong context
```
Input: "Dưa hấu"
Context: KHÔNG có "Dưa hấu"
Expected: Trả về null (không chuẩn hóa)
```

### Test Case 3: Keyword chung chung
```
Input: "Fruity"
Context: Có "Trái cây", "Quả táo", "Quả lê", "Dứa"
Expected: Trả về ["Trái cây"] (chỉ 1 giá trị chung, không trả về tất cả)
```

## Related Files

- `src/application/constant/prompts/system.prompt.ts` - Prompt normalization
- `src/chatbot/tools/master-data.tool.ts` - Tool searchMasterData
- `src/infrastructure/domain/common/master-data.service.ts` - Service tìm kiếm master data

## Notes

- Prompt mới yêu cầu AI **kiểm tra context trước khi trả về** - điều này giúp tránh bịa từ.
- Nếu AI vẫn bịa từ, cần xem lại **context được truyền vào** có đầy đủ không.
- Có thể cần **tune temperature** của AI model để giảm tính "sáng tạo" (đề xuất: 0.2-0.3).

---

**Last Updated**: April 13, 2026  
**Status**: ✅ Fixed
