import { Injectable, Logger } from '@nestjs/common';
import { aiModel } from 'src/chatbot/ai-model';
import { generateObject } from 'ai';
import { SearchObjectDto, GenderIntent } from '../../application/dtos/request/search-object.dto';
import { z } from 'zod';
import { AdminInstructionService } from './admin-instruction.service';
import { INSTRUCTION_TYPE_SEARCH_EXTRACTION } from 'src/application/constant/prompts/admin-instruction-types';

@Injectable()
export class SearchAiService {
    private readonly logger = new Logger(SearchAiService.name);

    constructor(private readonly adminInstructionService: AdminInstructionService) { }

    private readonly searchObjectSchema = z.object({
        brand: z.string().optional().describe('Thương hiệu nước hoa (ví dụ: Chanel, Dior, Creed)'),
        productName: z.string().optional().describe('Tên cụ thể của sản phẩm (ví dụ: Sauvage, Bleu de Chanel)'),
        category: z.string().optional().describe('Loại sản phẩm (ví dụ: Nước hoa nam, Nước hoa nữ, Nữ, Nam)'),
        gender: z.nativeEnum(GenderIntent).optional().describe('Giới tính mục tiêu'),
        minPrice: z.number().optional().describe('Giá tối thiểu (VNĐ)'),
        maxPrice: z.number().optional().describe('Giá tối đa (VNĐ)'),
        notes: z.array(z.string()).optional().describe('Các nốt hương cụ thể (ví dụ: hoa hồng, gỗ đàn hương, cam chanh)'),
        families: z.array(z.string()).optional().describe('Nhóm hương (ví dụ: Floral, Woody, Oriental)'),
        concentration: z.string().optional().describe('Nồng độ (ví dụ: EDP, EDT, Parfum)'),
        volume: z.number().optional().describe('Dung tích ml (ví dụ: 100, 50, 10)'),
        occasion: z.string().optional().describe('Dịp sử dụng (ví dụ: đi tiệc, đi làm, hẹn hò)'),
        season: z.string().optional().describe('Mùa sử dụng (ví dụ: mùa đông, mùa hè)'),
        description: z.string().optional().describe('Mô tả thêm về phong cách hoặc cảm giác (ví dụ: quyến rũ, tươi mát)'),
    });

    private readonly fallbackSystemPrompt = `
# MỤC TIÊU
- Phân tích câu truy vấn tìm kiếm của người dùng và trích xuất thông tin cấu trúc (Structured Intent) để tìm kiếm trong database nước hoa.

# VÌ SAO CẦN CÁC BƯỚC NÀY
- Chuyển đổi ngôn ngữ tự nhiên thành các filter chính xác (brand, price, gender, notes).
- Xử lý các biến thể từ ngữ (ví dụ: "cho nữ" -> gender: Female, "dưới 1 triệu" -> maxPrice: 1000000).
- Tăng độ chính xác cho Elasticsearch bằng cách cung cấp các trường dữ liệu rõ ràng thay vì chỉ dùng keyword thô.

# BƯỚC 1: TRÍCH XUẤT THƯƠNG HIỆU & SẢN PHẨM
- Nhận diện các thương hiệu nước hoa (Chanel, Dior, Creed, ...) và tên dòng sản phẩm (Sauvage, Bleu, ...).
- Nếu người dùng viết sai chính tả nhẹ, hãy cố gắng đưa về tên chuẩn.

# BƯỚC 2: XỬ LÝ GIỚI TÍNH
- Xác định gender từ các từ khóa: nam, nữ, unisex, men, women, boy, girl, cho mẹ, cho bạn trai, ...
- Mapping: "nam" -> Male, "nữ" -> Female, "unisex" -> Unisex.

# BƯỚC 3: PHÂN TÍCH KHOẢNG GIÁ
- Trích xuất minPrice và maxPrice (đơn vị VNĐ).
- "dưới X": maxPrice = X.
- "trên X": minPrice = X.
- "từ X đến Y": minPrice = X, maxPrice = Y.

# BƯỚC 4: NHẬN DIỆN MÙI HƯƠNG & ĐẶC TÍNH
- Liệt kê các nốt hương (notes) như: hoa hồng, gỗ, cam chanh, vani...
- Liệt kê nhóm hương (families): Floral, Woody, Oriental, ...
- Trích xuất nồng độ (EDP, EDT, ...) và dung tích (ml).

# BƯỚC 5: NGỮ CẢNH SỬ DỤNG
- Xác định dịp (occasion): đi tiệc, đi làm, hẹn hò...
- Xác định mùa (season): mùa hè, mùa đông...

# LƯU Ý QUAN TRỌNG
- Nếu không có thông tin cho một trường nào đó, hãy để trống hoặc null.
- Tuyệt đối không bịa thêm thông tin không có trong câu truy vấn.
`;

    async extractSearchObject(searchText: string): Promise<SearchObjectDto> {
        this.logger.log(`[AI-Search] Extracting search object for: "${searchText}"`);

        // Fetch structured prompt from admin instructions (seeded or managed via API)
        const systemPromptFromDb = await this.adminInstructionService.getSystemPromptForDomain(INSTRUCTION_TYPE_SEARCH_EXTRACTION);
        const finalSystemPrompt = systemPromptFromDb || this.fallbackSystemPrompt;

        try {
            const result = await generateObject({
                model: aiModel,
                schema: this.searchObjectSchema,
                prompt: searchText,
                system: finalSystemPrompt,
            });
            this.logger.log(`[AI-Search] Extracted object: ${JSON.stringify(result.object)}`);
            return result.object as SearchObjectDto;
        } catch (error) {
            this.logger.error(`[AI-Search] Error extracting search object:`, error);
            // Fallback: return empty object if AI fails
            return {};
        }
    }
}
