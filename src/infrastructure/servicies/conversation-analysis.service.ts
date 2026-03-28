import { Injectable, Logger } from '@nestjs/common';
import { UIMessage } from 'ai';
import { aiModelForOptimizePrompt } from 'src/chatbot/ai-model';
import { textGenerationFromMessagesToResultWithErrorHandler } from 'src/chatbot/chatbot';
import { CONVERSATION_ANALYSIS_SYSTEM_PROMPT } from 'src/application/constant/prompts';
import { Tools } from 'src/chatbot/utils/tools';
import { analysisOutput, AnalysisObject } from 'src/chatbot/utils/output/analysis.output';

@Injectable()
export class ConversationAnalysisService {
    private readonly logger = new Logger(ConversationAnalysisService.name);

    constructor(private readonly tools: Tools) { }

    async analyze(messages: UIMessage[]): Promise<AnalysisObject | null> {
        try {
            this.logger.log('[ConversationAnalysis] Starting analysis...');

            const result = await textGenerationFromMessagesToResultWithErrorHandler(
                aiModelForOptimizePrompt,
                messages,
                CONVERSATION_ANALYSIS_SYSTEM_PROMPT,
                this.tools.getToolsForAnalysis,
                'Failed to analyze conversation intent',
                10,
                analysisOutput,
                0.3 // Lower temperature for more consistent JSON
            );

            if (!result) {
                this.logger.warn('[ConversationAnalysis] Analysis returned null');
                return null;
            }

            const analysis = JSON.parse(result) as AnalysisObject;
            this.logger.log(`[ConversationAnalysis] Analysis completed. Intent: ${analysis.intent}`);
            return analysis;
        } catch (error) {
            this.logger.error('[ConversationAnalysis] Analysis failed', error);
            return null;
        }
    }
}
