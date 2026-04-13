import { Injectable, Logger } from '@nestjs/common';
import { Output } from 'ai';
import { aiModelForOptimizePrompt } from 'src/chatbot/ai-model';
import { textGenerationFromPromptToResultWithErrorHandler } from 'src/chatbot/chatbot';
import { CONVERSATION_ANALYSIS_SYSTEM_PROMPT, INTENT_ONLY_ANALYSIS_SYSTEM_PROMPT, SURVEY_ANALYSIS_SYSTEM_PROMPT, TREND_ANALYSIS_SYSTEM_PROMPT } from 'src/application/constant/prompts';
import { SURVEY_ANSWER_ANALYSIS_SYSTEM_PROMPT } from 'src/application/constant/prompts/survey-question.analysis.system';
import { Tools } from 'src/chatbot/tools';
import { analysisOutput, AnalysisObject, intentOnlyOutput, IntentOnlyObject } from 'src/chatbot/output/analysis.output';
import { surveyAnswerAnalysis, SurveyAnswerAnalysisObject } from 'src/chatbot/output/survey-question.analysis.output';
import { encodeToolOutput } from 'src/chatbot/utils/toon-encoder.util';

type AnalysisRuntimeContext = {
    userId?: string;
    isGuestUser?: boolean;
};

@Injectable()
export class AiAnalysisService {
    private readonly logger = new Logger(AiAnalysisService.name);

    constructor(private readonly tools: Tools) { }

    async analyze(
        currentMessage: string,
        previousMessages?: string,
        context?: AnalysisRuntimeContext
    ): Promise<AnalysisObject | null> {
        try {
            this.logger.log(`[AiAnalysis] Starting context-aware analysis...`);
            if (!currentMessage) {
                this.logger.warn('[AiAnalysis] Current message is empty or undefined');
                return null;
            }

            const input = JSON.stringify({
                previousMessages: previousMessages || 'No previous context.',
                currentMessage: currentMessage,
                analysisContext: {
                    userId: context?.userId ?? null,
                    isGuestUser: context?.isGuestUser ?? false
                }
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

    async analyzeIntentOnly(currentMessage: string, previousMessages?: string): Promise<IntentOnlyObject | null> {
        try {
            this.logger.log(`[AiAnalysis] Starting intent-only analysis...`);
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
                INTENT_ONLY_ANALYSIS_SYSTEM_PROMPT,
                undefined,
                'Failed to analyze intent only',
                10,
                Output.object(intentOnlyOutput),
                0.2 // Low temperature for consistent intent
            );

            if (!result) {
                this.logger.warn('[AiAnalysis] Intent analysis returned null');
                return null;
            }

            const analysis = JSON.parse(result) as IntentOnlyObject;
            this.logger.log(`[AiAnalysis] Intent analysis completed. Intent: ${analysis.intent}`);
            return analysis;
        } catch (error) {
            this.logger.error('[AiAnalysis] Intent analysis failed', error);
            return null;
        }
    }

    async analyzeSurvey(quesAnses: Array<{ question: string; answer: string }>): Promise<AnalysisObject | null> {
        try {
            this.logger.log(`[AiAnalysis] Analyzing survey Q&A...`);
            if (!quesAnses || quesAnses.length === 0) {
                this.logger.warn('[AiAnalysis] Survey Q&A is empty');
                return null;
            }

            const input = encodeToolOutput(quesAnses).encoded;

            const result = await textGenerationFromPromptToResultWithErrorHandler(
                aiModelForOptimizePrompt,
                input,
                SURVEY_ANALYSIS_SYSTEM_PROMPT,
                this.tools.getToolsForAnalysis,
                'Failed to analyze survey intent',
                10,
                Output.object(analysisOutput),
                0.2 // Slightly lower temperature for survey consistency
            );

            if (!result) {
                this.logger.warn('[AiAnalysis] Survey analysis returned null');
                return null;
            }

            const analysis = JSON.parse(result) as AnalysisObject;
            this.logger.log(`[AiAnalysis] Survey analysis completed. Explanation: ${analysis.explanation}`);
            return analysis;
        } catch (error) {
            this.logger.error('[AiAnalysis] Survey analysis failed', error);
            return null;
        }
    }

    async analyzeTrend(
        trendSignals: Array<{ keyword: string; score: number; source: string }>
    ): Promise<AnalysisObject | null> {
        try {
            this.logger.log(`[AiAnalysis] Starting trend analysis for ${trendSignals.length} signals...`);
            if (!trendSignals || trendSignals.length === 0) {
                this.logger.warn('[AiAnalysis] Trend signals are empty');
                return null;
            }

            const input = JSON.stringify({ trendSignals });

            const result = await textGenerationFromPromptToResultWithErrorHandler(
                aiModelForOptimizePrompt,
                input,
                TREND_ANALYSIS_SYSTEM_PROMPT,
                this.tools.getToolsForAnalysis,
                'Failed to analyze trend signals',
                10,
                Output.object(analysisOutput),
                0.2
            );

            if (!result) {
                this.logger.warn('[AiAnalysis] Trend analysis returned null');
                return null;
            }

            const analysis = JSON.parse(result) as AnalysisObject;

            // Force no function call — trend pipeline always decides this externally
            analysis.functionCall = null;
            analysis.intent = 'Search';
            if (!analysis.pagination) {
                analysis.pagination = { pageNumber: 1, pageSize: 50 };
            }

            this.logger.log(`[AiAnalysis] Trend analysis completed. Logic groups: ${analysis.logic?.length ?? 0}`);
            return analysis;
        } catch (error) {
            this.logger.error('[AiAnalysis] Trend analysis failed', error);
            return null;
        }
    }

    /**
     * Analyze a SINGLE survey answer to extract search criteria.
     * Uses searchMasterData tool to normalize keywords before building logic.
     * 
     * @param qa Single question-answer pair
     * @returns AnalysisObject or null if failed
     */
    async analyzeSurveyAnswer(
        qa: { question: string; answer: string }
    ): Promise<AnalysisObject | null> {
        try {
            this.logger.log(`[AiAnalysis] Analyzing survey answer: ${qa.answer.substring(0, 50)}...`);
            if (!qa || !qa.answer) {
                this.logger.warn('[AiAnalysis] Survey answer is empty');
                return null;
            }

            const input = JSON.stringify({
                question: qa.question,
                answer: qa.answer
            });

            const result = await textGenerationFromPromptToResultWithErrorHandler(
                aiModelForOptimizePrompt,
                input,
                SURVEY_ANSWER_ANALYSIS_SYSTEM_PROMPT,
                this.tools.getToolsForAnalysis,
                'Failed to analyze survey answer',
                10,
                Output.object(surveyAnswerAnalysis),
                0.2
            );

            if (!result) {
                this.logger.warn('[AiAnalysis] Survey answer analysis returned null');
                return null;
            }

            const analysis = JSON.parse(result) as AnalysisObject;
            this.logger.log(
                `[AiAnalysis] Survey answer analysis completed. ` +
                `Answer: "${qa.answer.substring(0, 30)}...", ` +
                `Intent: ${analysis.intent}, ` +
                `Logic groups: ${analysis.logic?.length ?? 0}`
            );
            return analysis;
        } catch (error) {
            this.logger.error('[AiAnalysis] Survey answer analysis failed', error);
            return null;
        }
    }
}
