import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class FptEmbeddingService {
  private readonly logger = new Logger(FptEmbeddingService.name);
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly model: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {
    this.apiKey = this.configService.get<string>('FPTCLOUD_API_KEY') || '';
    this.endpoint =
      this.configService.get<string>('FPTCLOUD_EMBEDDING_ENDPOINT') ||
      'https://mkp-api.fptcloud.com/v1/embeddings';
    this.model =
      this.configService.get<string>('FPTCLOUD_EMBEDDING_MODEL') ||
      'Vietnamese_Embedding';
  }

  /**
   * Generate embedding cho text bằng FPT Cloud AI
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      this.logger.log(
        `Generating FPT embedding for text (length: ${text.length})...`
      );

      const response = await firstValueFrom(
        this.httpService.post(
          this.endpoint,
          {
            model: this.model,
            input: [text],
            encoding_format: 'float'
          },
          {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json'
            }
          }
        )
      );

      // Theo format OpenAI-compatible mà FPT Cloud thường dùng: response.data.data[0].embedding
      const embedding = response.data?.data?.[0]?.embedding;

      if (!embedding || !Array.isArray(embedding)) {
        this.logger.error(
          'Invalid embedding format from FPT Cloud',
          response.data
        );
        throw new Error('Invalid embedding response');
      }

      this.logger.log(
        `Successfully generated FPT embedding (${embedding.length} dimensions)`
      );
      return embedding;
    } catch (error) {
      this.logger.error(
        `Error generating FPT embedding: ${error.message}`,
        error.response?.data
      );
      throw error;
    }
  }
}
