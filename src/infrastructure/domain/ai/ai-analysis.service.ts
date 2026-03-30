import { Injectable, Logger } from '@nestjs/common';
import { Output } from 'ai';
import { aiModelForOptimizePrompt } from 'src/chatbot/ai-model';
import { textGenerationFromPromptToResultWithErrorHandler } from 'src/chatbot/chatbot';
import { CONVERSATION_ANALYSIS_SYSTEM_PROMPT } from 'src/application/constant/prompts';
import { Tools } from 'src/chatbot/utils/tools';
import { analysisOutput, AnalysisObject } from 'src/chatbot/utils/output/analysis.output';

@Injectable()
export class AiAnalysisService {
    private readonly logger = new Logger(AiAnalysisService.name);

    constructor(private readonly tools: Tools) { }

    async analyze(currentMessage: string, previousMessages?: string): Promise<AnalysisObject | null> {
        try {
            this.logger.log(`[AiAnalysis] Starting context-aware analysis...`);
            if (!currentMessage) {
                this.logger.warn('[AiAnalysis] Current message is empty or undefined');
                return null;
            }

            const input = JSON.stringify({
                previousMessages: previousMessages || 'No previous context.',
                currentMessage: currentMessage
            });

            const result = await textGenerationFromPromptToResultWithErrorHandler(
                aiModelForOptimizePrompt,
                input,
                CONVERSATION_ANALYSIS_SYSTEM_PROMPT,
                this.tools.getToolsForAnalysis,
                'Failed to analyze intent',
                10,
                Output.object(analysisOutput),
                0.3 // Zero temperature for absolute consistency
            );

            if (!result) {
                this.logger.warn('[AiAnalysis] Analysis returned null');
                return null;
            }

            const analysis = JSON.parse(result) as AnalysisObject;
            this.logger.log(`[AiAnalysis] Analysis completed. Intent: ${analysis.intent}`);
            return analysis;
        } catch (error) {
            this.logger.error('[AiAnalysis] Analysis failed', error);
            return null;
        }
    }
}
