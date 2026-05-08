import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Inject, Logger } from '@nestjs/common';
import { QueueName } from 'src/application/constant/processor';
import {
  INSTRUCTION_TYPE_CONVERSATION,
  INSTRUCTION_TYPE_CONVERSATION_ANALYSIS
} from 'src/application/constant/prompts/admin-instruction-types';
import { IMPROVER_SYSTEM_PROMPT, buildImproverPrompt } from 'src/application/constant/prompts';
import { improverOutputSchema, ImproverOutput } from 'src/application/constant/improver.output';
import { AdminInstructionService } from 'src/infrastructure/domain/admin-instruction/admin-instruction.service';
import { UnitOfWork } from 'src/infrastructure/domain/repositories/unit-of-work';
import { AIHelper } from 'src/infrastructure/domain/helpers/ai.helper';
import { AI_CONVERSATION_HELPER } from 'src/infrastructure/domain/ai/ai.module';

interface ImproverJobData {
  conversationId: string;
}

/** Minimum confidence (%) per instruction type for the improver to auto-apply an upgrade */
const CONFIDENCE_THRESHOLD = 95;

/** Minimum messages in a conversation before the improver will analyze it */
const MIN_MESSAGES_FOR_ANALYSIS = 4;

/**
 * ConversationImproverProcessor — AI Self-Improvement Pipeline
 *
 * After a conversation goes idle (~1 min), this BullMQ processor:
 * 1. Loads the conversation + current AdminInstructions
 * 2. Asks the improver AI to evaluate AI response quality
 * 3. Auto-applies instruction upgrades per-type if confidence ≥ 80%
 *
 * Confidence is evaluated independently per instruction type:
 * - conversationConfidence ≥ 80% → apply CONVERSATION instruction upgrade
 * - analysisConfidence ≥ 80% → apply CONVERSATION_ANALYSIS prompt upgrade
 *
 * WHY: Enables the chatbot to continuously self-improve without manual intervention.
 */
@Processor({
  name: QueueName.CONVERSATION_IMPROVER_QUEUE
})
export class ConversationImproverProcessor extends WorkerHost {
  private readonly logger = new Logger(ConversationImproverProcessor.name);

  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly adminInstructionService: AdminInstructionService,
    @Inject(AI_CONVERSATION_HELPER) private readonly aiHelper: AIHelper
  ) {
    super();
  }

  async process(job: Job<ImproverJobData>): Promise<void> {
    const { conversationId } = job.data;
    const startedAt = Date.now();

    this.logger.log(
      `[IMPROVER] ▶ Job received: jobId=${job.id} conversationId=${conversationId} attemptsMade=${job.attemptsMade}`
    );

    try {
      await this.analyzeAndImprove(conversationId, startedAt);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `[IMPROVER] ✗ Job FAILED: conversationId=${conversationId} durationMs=${Date.now() - startedAt} error=${msg}`
      );
    }
  }

  private async analyzeAndImprove(
    conversationId: string,
    startedAt: number
  ): Promise<void> {
    // Step 1: Load conversation
    this.logger.log(`[IMPROVER] Step 1/4: Loading conversation ${conversationId}`);
    const conversation = await this.unitOfWork.AIConversationRepo.findOne(
      { id: conversationId },
      { populate: ['messages'] }
    );

    if (!conversation) {
      this.logger.warn(
        `[IMPROVER] ✗ Conversation ${conversationId} not found — skipping`
      );
      return;
    }

    const messages = conversation.messages.getItems();
    this.logger.log(
      `[IMPROVER] Conversation ${conversationId}: ${messages.length} messages loaded (elapsed: ${Date.now() - startedAt}ms)`
    );

    if (messages.length < MIN_MESSAGES_FOR_ANALYSIS) {
      this.logger.log(
        `[IMPROVER] ⊘ Conversation ${conversationId} too short (${messages.length} < ${MIN_MESSAGES_FOR_ANALYSIS} msgs) — skipping`
      );
      return;
    }

    // Step 2: Load current instructions
    this.logger.log(`[IMPROVER] Step 2/4: Loading current instructions`);
    const { currentInstruction, currentAnalysisPrompt } =
      await this.loadCurrentInstructions();
    this.logger.log(
      `[IMPROVER] Instructions loaded: CONVERSATION=${currentInstruction.length} chars, ANALYSIS=${currentAnalysisPrompt.length} chars (elapsed: ${Date.now() - startedAt}ms)`
    );

    // Step 3: Call improver AI
    this.logger.log(`[IMPROVER] Step 3/4: Calling improver AI`);
    const conversationText = this.formatConversationForAnalysis(messages);
    const prompt = buildImproverPrompt(
      conversationText,
      currentInstruction,
      currentAnalysisPrompt,
      CONFIDENCE_THRESHOLD
    );

    const improverResult = await this.callImproverAI(prompt);

    if (!improverResult) {
      this.logger.warn(
        `[IMPROVER] ✗ AI call returned no result for ${conversationId} (elapsed: ${Date.now() - startedAt}ms)`
      );
      return;
    }

    this.logger.log(
      `[IMPROVER] AI call completed: conversationConfidence=${improverResult.conversationConfidence}% analysisConfidence=${improverResult.analysisConfidence}% (elapsed: ${Date.now() - startedAt}ms)`
    );

    // Step 4: Evaluate & apply
    this.logger.log(`[IMPROVER] Step 4/4: Evaluating result & applying upgrades`);
    this.handleResult(conversationId, improverResult, startedAt);
  }

  /** Fetch current conversation + analysis prompt from AdminInstruction DB */
  private async loadCurrentInstructions(): Promise<{
    currentInstruction: string;
    currentAnalysisPrompt: string;
  }> {
    const [instructionRes, analysisRes] = await Promise.all([
      this.adminInstructionService.getCombinedPromptByType(
        INSTRUCTION_TYPE_CONVERSATION
      ),
      this.adminInstructionService.getCombinedPromptByType(
        INSTRUCTION_TYPE_CONVERSATION_ANALYSIS
      )
    ]);

    return {
      currentInstruction: instructionRes.success && instructionRes.data
        ? instructionRes.data
        : '',
      currentAnalysisPrompt: analysisRes.success && analysisRes.data
        ? analysisRes.data
        : ''
    };
  }

  /** Call improver AI with structured object generation */
  private async callImproverAI(
    prompt: string
  ): Promise<ImproverOutput | null> {
    const result = await this.aiHelper.objectGenerateFromPrompt<ImproverOutput>(
      prompt,
      improverOutputSchema,
      IMPROVER_SYSTEM_PROMPT
    );

    if (!result.success || !result.data) {
      this.logger.warn(
        `[IMPROVER] AI object generation failed: ${result.error || 'unknown'}`
      );
      return null;
    }

    return result.data;
  }

  /** Evaluate improver result and apply upgrades per-type based on individual confidence */
  private handleResult(
    conversationId: string,
    result: ImproverOutput,
    startedAt: number
  ): void {
    const {
      conversationConfidence,
      analysisConfidence,
      improvedInstruction,
      improvedAnalysisPrompt,
      reason
    } = result;

    this.logger.log(
      `[IMPROVER] Result: conversationConfidence=${conversationConfidence}% analysisConfidence=${analysisConfidence}% reason="${reason}"`
    );

    // Check CONVERSATION instruction independently
    const applyConversation = conversationConfidence >= CONFIDENCE_THRESHOLD
      && improvedInstruction.trim() !== '';
    // Check CONVERSATION_ANALYSIS prompt independently
    const applyAnalysis = analysisConfidence >= CONFIDENCE_THRESHOLD
      && improvedAnalysisPrompt.trim() !== '';

    if (!applyConversation) {
      this.logger.log(
        `[IMPROVER] ⊘ CONVERSATION instruction skipped: confidence ${conversationConfidence}% < ${CONFIDENCE_THRESHOLD}% or no improvement proposed`
      );
    } else {
      this.logger.log(
        `[IMPROVER] ✓ CONVERSATION instruction approved: confidence=${conversationConfidence}% ≥ ${CONFIDENCE_THRESHOLD}%`
      );
    }

    if (!applyAnalysis) {
      this.logger.log(
        `[IMPROVER] ⊘ CONVERSATION_ANALYSIS prompt skipped: confidence ${analysisConfidence}% < ${CONFIDENCE_THRESHOLD}% or no improvement proposed`
      );
    } else {
      this.logger.log(
        `[IMPROVER] ✓ CONVERSATION_ANALYSIS prompt approved: confidence=${analysisConfidence}% ≥ ${CONFIDENCE_THRESHOLD}%`
      );
    }

    if (!applyConversation && !applyAnalysis) {
      this.logger.log(
        `[IMPROVER] ⊘ No upgrades applied (total: ${Date.now() - startedAt}ms)`
      );
      return;
    }

    void this.applyUpgrades(
      conversationId,
      applyConversation ? improvedInstruction.trim() : '',
      applyAnalysis ? improvedAnalysisPrompt.trim() : '',
      conversationConfidence,
      analysisConfidence,
      startedAt
    );
  }

  /** Format conversation messages into readable text for AI analysis */
  private formatConversationForAnalysis(
    messages: { sender: string; message: string; createdAt?: Date }[]
  ): string {
    return messages
      .map((m) => {
        const role = m.sender === 'user' ? 'USER' : 'AI';
        const time = m.createdAt
          ? new Date(m.createdAt).toISOString()
          : 'unknown';
        return `[${role} @ ${time}]\n${m.message}`;
      })
      .join('\n\n');
  }

  /** Apply approved upgrades to AdminInstruction DB */
  private async applyUpgrades(
    conversationId: string,
    improvedInstruction: string,
    improvedAnalysisPrompt: string,
    conversationConfidence: number,
    analysisConfidence: number,
    startedAt?: number
  ): Promise<void> {
    await Promise.all([
      this.updateInstructionByType(
        INSTRUCTION_TYPE_CONVERSATION,
        improvedInstruction,
        conversationId,
        'CONVERSATION instruction',
        conversationConfidence
      ),
      this.updateInstructionByType(
        INSTRUCTION_TYPE_CONVERSATION_ANALYSIS,
        improvedAnalysisPrompt,
        conversationId,
        'CONVERSATION_ANALYSIS prompt',
        analysisConfidence
      )
    ]);

    this.logger.log(
      `[IMPROVER] ✓ Job COMPLETED: conversationId=${conversationId} totalDuration=${startedAt ? Date.now() - startedAt : '?'}ms`
    );
  }

  /** Shared helper: update a single instruction type if improved content exists */
  private async updateInstructionByType(
    type: string,
    improvedContent: string,
    conversationId: string,
    label: string,
    confidence: number
  ): Promise<void> {
    if (!improvedContent || improvedContent.trim() === '') return;

    const existing = await this.adminInstructionService.getInstructionsByType(type);

    if (existing.success && existing.data && existing.data.length > 0) {
      const oldInstruction = existing.data[0].instruction;

      await this.adminInstructionService.updateInstruction(
        existing.data[0].id,
        { instruction: improvedContent }
      );

      this.logger.log(
        `[IMPROVER] Updated ${label} for conversation ${conversationId} (confidence ${confidence}%)`
      );
      this.logger.log(
        `[IMPROVER] ${label} BEFORE:\n${oldInstruction.substring(0, 500)}${oldInstruction.length > 500 ? '...(truncated)' : ''}`
      );
      this.logger.log(
        `[IMPROVER] ${label} AFTER:\n${improvedContent.substring(0, 500)}${improvedContent.length > 500 ? '...(truncated)' : ''}`
      );
    }
  }
}