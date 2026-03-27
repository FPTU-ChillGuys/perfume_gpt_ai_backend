import { Injectable, Logger } from '@nestjs/common';
import { aiModel, aiModelForSearch } from 'src/chatbot/ai-model';
import { generateObject } from 'ai';
import { SearchObjectDto, GenderIntent } from '../../application/dtos/request/search-object.dto';
import { z } from 'zod';
import { AdminInstructionService } from './admin-instruction.service';
import { INSTRUCTION_TYPE_SEARCH_EXTRACTION } from 'src/application/constant/prompts/admin-instruction-types';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SearchAiService {
    private readonly logger = new Logger(SearchAiService.name);

    constructor(
        private readonly adminInstructionService: AdminInstructionService,
        private readonly prismaService: PrismaService
    ) { }

    private readonly searchObjectSchema = z.object({
        brand: z.string().optional().describe('Thương hiệu nước hoa (ví dụ: Chanel, Dior, Creed)'),
        productName: z.string().optional().describe('Tên cụ thể của sản phẩm (ví dụ: Sauvage, Bleu de Chanel)'),
        category: z.string().optional().describe('Loại sản phẩm (ví dụ: Nước hoa nam, Nước hoa nữ)'),
        gender: z.nativeEnum(GenderIntent).optional().describe('Giới tính mục tiêu'),
        minPrice: z.number().optional().describe('Giá tối thiểu (VNĐ)'),
        maxPrice: z.number().optional().describe('Giá tối đa (VNĐ)'),
        notes: z.array(z.string()).optional().describe('Các nốt hương chung chung'),
        topNotes: z.array(z.string()).optional().describe('Nốt hương đầu'),
        middleNotes: z.array(z.string()).optional().describe('Nốt hương giữa'),
        baseNotes: z.array(z.string()).optional().describe('Nốt hương cuối'),
        families: z.array(z.string()).optional().describe('Nhóm hương'),
        concentration: z.string().optional().describe('Nồng độ (ví dụ: EDP, EDT)'),
        volume: z.number().optional().describe('Dung tích ml'),
        occasion: z.string().optional().describe('Dịp sử dụng'),
        weatherSeason: z.string().optional().describe('Thời tiết/Mùa phù hợp'),
        ageGroup: z.string().optional().describe('Nhóm tuổi'),
        style: z.string().optional().describe('Phong cách'),
        scentCharacter: z.string().optional().describe('Đặc tính mùi hương'),
        timeOfDay: z.string().optional().describe('Thời điểm trong ngày'),
        giftSuitability: z.string().optional().describe('Phù hợp làm quà tặng'),
        skinType: z.string().optional().describe('Loại da'),
        minLongevity: z.number().optional().describe('Độ lưu hương tối thiểu (1-12)'),
        minSillage: z.number().optional().describe('Độ tỏa hương tối thiểu (1-5)'),
        description: z.string().optional().describe('Mô tả thêm phong cách cá tính'),
    });

    /**
     * Dynamically builds a list of existing values from DB to help AI mapping
     */
    private async getSupplementaryPrompt(): Promise<string> {
        try {
            const [attributes, notes, families] = await Promise.all([
                this.prismaService.attributes.findMany({ include: { AttributeValues: true } }),
                this.prismaService.scentNotes.findMany({ take: 200 }),
                this.prismaService.olfactoryFamilies.findMany()
            ]);

            let text = "\n# DỮ LIỆU THỰC TẾ TỪ HỆ THỐNG (CHỈ DÙNG CÁC GIÁ TRỊ NÀY, TUYỆT ĐỐI KHÔNG DỊCH SANG TIẾNG ANH):\n";

            attributes.forEach(attr => {
                const values = attr.AttributeValues.map(v => v.Value).join(', ');
                text += `- ${attr.Name} (${attr.InternalCode}): [${values}]\n`;
            });

            text += `- Scent Notes (Nốt hương): [${notes.map(n => n.Name).join(', ')}]\n`;
            text += `- Olfactory Families (Nhóm hương): [${families.map(f => f.Name).join(', ')}]\n`;

            text += "\nLƯU Ý QUAN TRỌNG: Nếu người dùng nói 'buổi hẹn hò' hãy dùng 'Buổi hẹn hò đêm' (từ danh sách occasion), TUYỆT ĐỐI KHÔNG trả về 'date' hay 'dating'. LUÔN GIỮ NGUYÊN TIẾNG VIỆT.\n";

            return text;
        } catch (error) {
            this.logger.error('[AI-Search] Error building supplementary prompt:', error);
            return "";
        }
    }

    async extractSearchObject(searchText: string): Promise<SearchObjectDto> {
        this.logger.log(`[AI-Search] Extracting search object for: "${searchText}"`);

        // Fetch structured prompt from admin instructions (seeded or managed via API)
        const systemPromptFromDb = await this.adminInstructionService.getSystemPromptForDomain(INSTRUCTION_TYPE_SEARCH_EXTRACTION);

        if (systemPromptFromDb) {
            this.logger.log(`[AI-Search] Using managed system prompt from DB`);
        } else {
            this.logger.warn(`[AI-Search] No system prompt found in DB for type: ${INSTRUCTION_TYPE_SEARCH_EXTRACTION}`);
        }

        // 2. Fetch dynamic supplementary data from DB
        const supplementaryPrompt = await this.getSupplementaryPrompt();

        try {
            const result = await generateObject({
                model: aiModelForSearch,
                schema: this.searchObjectSchema,
                prompt: searchText,
                system: `${systemPromptFromDb || ""}\n${supplementaryPrompt}\n\nLƯU Ý QUAN TRỌNG: LUÔN TRẢ VỀ GIÁ TRỊ TIẾNG VIỆT CHUẨN TỪ DANH SÁCH. TUYỆT ĐỐI KHÔNG DỊCH SANG TIẾNG ANH.`,
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
