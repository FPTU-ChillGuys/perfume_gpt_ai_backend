import { Injectable, Logger } from '@nestjs/common';
import { aiModel, aiModelForSearch } from 'src/chatbot/ai-model';
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


    async extractSearchObject(searchText: string): Promise<SearchObjectDto> {
        this.logger.log(`[AI-Search] Extracting search object for: "${searchText}"`);

        // Fetch structured prompt from admin instructions (seeded or managed via API)
        const systemPromptFromDb = await this.adminInstructionService.getSystemPromptForDomain(INSTRUCTION_TYPE_SEARCH_EXTRACTION);

        if (systemPromptFromDb) {
            this.logger.log(`[AI-Search] Using managed system prompt from DB`);
        } else {
            this.logger.warn(`[AI-Search] No system prompt found in DB for type: ${INSTRUCTION_TYPE_SEARCH_EXTRACTION}`);
        }

        try {
            const result = await generateObject({
                model: aiModelForSearch,
                schema: this.searchObjectSchema,
                prompt: searchText,
                system: systemPromptFromDb || undefined,
            });
            this.logger.log(`[AI-Search] --- Extraction Result for: "${searchText}" ---`);
            this.logger.log(JSON.stringify(result.object, null, 2));
            this.logger.log(`[AI-Search] -------------------------------------------`);
            return result.object as SearchObjectDto;
        } catch (error) {
            this.logger.error(`[AI-Search] Error extracting search object:`, error);
            // Fallback: return empty object if AI fails
            return {};
        }
    }
}
