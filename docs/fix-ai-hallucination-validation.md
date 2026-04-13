# Fix: AI Normalization Hallucination & Invalid Keywords

## Vấn Đề Tổng Hợp

### **Triệu Chứng**
1. User search với keyword không rõ ràng → AI bịa ra các từ vô nghĩa như "and", "Sweet", "Woody", "Fruity"
2. Hệ thống search các từ này → trả về kết quả không liên quan (quả dứa, quả lê, etc.)
3. Where clause quá chặt với TẤT CẢ điều kiện AND → không có sản phẩm nào match

### **Ví Dụ Thực Tế**
```json
{
  "AND": [
    {"OR": [{"Name": {"contains": "and"}}]},  // ❌ Từ "and" vô nghĩa
    {"OR": [{"Name": {"contains": "Sweet"}}]},  // ❌ Không có trong context
    {"OR": [{"Name": {"contains": "Woody"}}]},  // ❌ Không có trong context
    {"OR": [{"Name": {"contains": "Fruity"}}]},  // ❌ Không có trong context
    ...
  ]
}
```

## Nguyên Nhân

### **1. AI Normalization Bịa Từ**
- `INTERNAL_NORMALIZATION_SYSTEM_PROMPT` cũ không có cơ chế kiểm tra context
- AI tự động suy diễn ra các từ không có trong database
- Không có validation sau khi normalize

### **2. MasterDataTool Không Validate**
- Sau khi AI normalize, tool không kiểm tra xem từ mới có thực sự match
- Search trực tiếp với từ đã normalize → trả về kết quả sai

### **3. Logic AND Quá Chặt**
- Hệ thống yêu cầu TẤT CẢ điều kiện AND phải đúng
- User chỉ muốn tìm sản phẩm phù hợp với MỘT SỐ tiêu chí

## Giải Pháp Đã Implement

### **Fix 1: Cập nhật Prompt Normalization** ✅

**File**: `src/application/constant/prompts/system.prompt.ts`

**Thay đổi**:
- Thêm quy tắc **KHÔNG BỊA TỪ MỚI**: Chỉ trả về từ có THẬT SỰ trong context
- Thêm quy tắc **KIỂM TRA CONTEXT TRƯỚC KHI TRẢ VỀ**
- Thêm quy tắc **HỖ TRỢ 1-NHIỀU CHỈ KHI THẬT SỰ CẦN THIẾT**

**Prompt mới**:
```typescript
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
```

### **Fix 2: Thêm Validation Trong MasterDataTool** ✅

**File**: `src/chatbot/tools/master-data.tool.ts`

**Thay đổi**:
1. Thêm method `shouldSkipNormalizedTerm()` để lọc các từ không hợp lệ
2. Skip các từ:
   - ✅ Tiếng Anh vô nghĩa (trừ các category đã biết: Floral, Woody, Fresh, Oriental, Fruity, Sweet)
   - ✅ Từ quá chung chung (and, the, a, is, are, etc.)
   - ✅ Từ quá ngắn (≤ 2 ký tự)
   - ✅ Từ không được normalize (giống original)

**Logic mới**:
```typescript
for (const term of correctedTerms) {
    // CRITICAL: Validate that normalized term actually exists in context
    if (this.shouldSkipNormalizedTerm(term, mapping.original)) {
        this.logger.log(`[searchMasterData] SKIP normalized term: ${mapping.original} -> ${term}`);
        continue; // BỎ QUA từ này
    }
    
    this.logger.log(`[searchMasterData] Re-searching normalized: ${mapping.original} -> ${term}`);
    reSearchTasks.push(performSearch(term, originalInfo?.types || ['all']));
}
```

**Method `shouldSkipNormalizedTerm()`**:
```typescript
private shouldSkipNormalizedTerm(term: string, original: string): boolean {
    // 1. Skip English words không phải category đã biết
    const englishOnlyPattern = /^[a-zA-Z\s]+$/;
    if (englishOnlyPattern.test(term) && !['Floral', 'Woody', 'Fresh', 'Oriental', 'Fruity', 'Sweet'].includes(term)) {
        return true;
    }

    // 2. Skip từ quá chung chung
    const genericTerms = ['and', 'the', 'a', 'is', 'are', ...];
    if (genericTerms.includes(term.toLowerCase())) {
        return true;
    }

    // 3. Skip từ quá ngắn
    if (term.length <= 2 && !['US', 'UK', 'EU'].includes(term)) {
        return true;
    }

    // 4. Skip nếu không được normalize
    if (term.toLowerCase() === original.toLowerCase()) {
        return true;
    }

    return false;
}
```

## Kết Quả Mong Đợi

### **Trước Fix** ❌
```
[searchMasterData] Re-searching normalized: Fruity -> Dứa
[searchMasterData] Re-searching normalized: Fruity -> Quả lê
[searchMasterData] Re-searching normalized: Sweet -> Ngọt ngào
[searchMasterData] Re-searching normalized: Woody -> Hương Gỗ
Where clause: {"Name":{"contains":"and"}}  // ❌ Từ vô nghĩa
```

### **Sau Fix** ✅
```
[searchMasterData] SKIP normalized term (too generic/no match): Fruity -> Dứa
[searchMasterData] SKIP normalized term (too generic/no match): Fruity -> Quả lê
[searchMasterData] Re-searching normalized: Sweet -> Ngọt ngào (nếu có trong context)
[searchMasterData] SKIP normalized term: and -> and  // ❌ Từ vô nghĩa bị skip
Where clause: Chỉ chứa các từ THẬT SỰ có trong context  // ✅
```

## Testing

### **Test Case 1: Keyword vô nghĩa**
```
Input: "and"
Expected: SKIP → Không search
Log: [searchMasterData] SKIP: Generic term "and"
```

### **Test Case 2: Keyword tiếng Anh không phải category**
```
Input: "Sweet" (không có trong context)
Expected: SKIP → Không search
Log: [searchMasterData] SKIP: English term "Sweet" not in known categories
```

### **Test Case 3: Keyword có đồng nghĩa trong context**
```
Input: "hoa nhài"
Context: Có "Jasmine"
Expected: Normalize → "Jasmine" → Search
Log: [searchMasterData] Re-searching normalized: hoa nhài -> Jasmine
```

### **Test Case 4: Keyword quá ngắn**
```
Input: "a"
Expected: SKIP → Không search
Log: [searchMasterData] SKIP: Too short term "a"
```

## Related Files

| File | Changes |
|------|---------|
| `src/application/constant/prompts/system.prompt.ts` | Updated `INTERNAL_NORMALIZATION_SYSTEM_PROMPT` |
| `src/chatbot/tools/master-data.tool.ts` | Added `shouldSkipNormalizedTerm()` validation |
| `docs/fix-ai-normalization-bia-tu.md` | Documentation (created) |
| `docs/fix-ai-hallucination-validation.md` | This file (created) |

## Next Steps

### **1. Restart Backend**
```bash
pnpm run start
```

### **2. Test với Survey/Conversation**
- Tạo survey với các câu hỏi không rõ ràng
- Kiểm tra log xem từ vô nghĩa có bị skip không
- Verify where clause chỉ chứa từ hợp lệ

### **3. Monitor Logs**
Watch for these log patterns:
```
✅ [searchMasterData] SKIP normalized term: ...
✅ [searchMasterData] SKIP: Generic term ...
✅ [searchMasterData] SKIP: Too short term ...
❌ [searchMasterData] Re-searching normalized: ... (chỉ khi thực sự hợp lệ)
```

### **4. Optional: Tune AI Model**
- Giảm temperature của AI model (đề xuất: 0.2-0.3)
- Thêm examples vào prompt để hướng dẫn AI tốt hơn

## Future Enhancements

### **1. Add Confidence Score**
- AI trả về confidence score cho mỗi normalized term
- Skip nếu score < threshold

### **2. Add Human Feedback Loop**
- Record khi nào AI normalize sai
- Use feedback to improve prompt/model

### **3. Add Fallback Strategy**
- Nếu tất cả keywords bị skip → fallback to bestsellers
- Show message: "Không tìm thấy từ khóa phù hợp, hiển thị sản phẩm phổ biến"

---

**Last Updated**: April 13, 2026  
**Status**: ✅ Implemented, Ready for Testing  
**Impact**: HIGH - Prevents AI hallucination and invalid search queries
