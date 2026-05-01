import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { UnitOfWork } from 'src/infrastructure/domain/repositories/unit-of-work';
import { AIAcceptance } from 'src/domain/entities/ai-acceptance.entities';
import { Injectable, Logger } from '@nestjs/common';
import { I18nErrorHandler } from 'src/infrastructure/domain/utils/i18n-error-handler';
import { v4 as uuid } from 'uuid';
import { AIAcceptanceContextType, AI_ACCEPTANCE_DEFAULT_VISIBLE_HOURS } from 'src/infrastructure/domain/ai-acceptance/ai-acceptance.constants';

export interface CreatePendingAIAcceptanceInput {
  contextType: AIAcceptanceContextType;
  sourceRefId?: string | null;
  productIds?: string[];
  metadata?: Record<string, unknown> | null;
  visibleInHours?: number;
}

export interface AttachAIAcceptanceToProductsInput<T = any> {
  contextType: AIAcceptanceContextType;
  sourceRefId?: string | null;
  products: T[];
  metadata?: Record<string, unknown> | null;
  visibleInHours?: number;
}

export interface AttachAIAcceptanceToProductsResult<T = any> {
  aiAcceptanceId: string | null;
  products: T[];
}

export interface AIAcceptanceMetrics {
  total: number;
  accepted: number;
  pending: number;
  noClick: number;
  acceptanceRate: number;
}

@Injectable()
export class AIAcceptanceService {
  private readonly logger = new Logger(AIAcceptanceService.name);

  constructor(private unitOfWork: UnitOfWork, private readonly err: I18nErrorHandler) { }

  private resolveVisibleAfterAt(visibleInHours?: number): Date {
    const hours = Number.isFinite(visibleInHours)
      ? Math.max(1, Number(visibleInHours))
      : AI_ACCEPTANCE_DEFAULT_VISIBLE_HOURS;
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }

  private isVisibleRecord(record: AIAcceptance, now: Date = new Date()): boolean {
    if (record.isAccepted) return true;
    if (!record.visibleAfterAt) return false;
    return new Date(record.visibleAfterAt).getTime() <= now.getTime();
  }

  private normalizeProductIds(productIds?: string[]): string[] {
    if (!Array.isArray(productIds)) return [];
    return Array.from(new Set(productIds.filter((id) => typeof id === 'string' && id.trim().length > 0)));
  }

  private extractProductIdsFromPayload(products: any[]): string[] {
    const extracted = products
      .map((item) => {
        if (typeof item?.id === 'string') return item.id;
        if (typeof item?.productId === 'string') return item.productId;
        return null;
      })
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    return this.normalizeProductIds(extracted);
  }

  async createPendingResponseAcceptance(
    input: CreatePendingAIAcceptanceInput
  ): Promise<BaseResponse<AIAcceptance>> {
    try {
      const normalizedProductIds = this.normalizeProductIds(input.productIds);
      const record = new AIAcceptance({
        isAccepted: false,
        contextType: input.contextType,
        responseId: uuid(),
        sourceRefId: input.sourceRefId ?? null,
        productIdsJson: normalizedProductIds.length > 0 ? JSON.stringify(normalizedProductIds) : null,
        metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
        visibleAfterAt: this.resolveVisibleAfterAt(input.visibleInHours),
        clickedAt: null
      });

      this.logger.log(`[AIAcceptance] Creating pending record for context=${input.contextType}, productIds=${normalizedProductIds.length}, sourceRefId=${input.sourceRefId}`);
      await this.unitOfWork.AIAcceptanceRepo.insert(record);
      this.logger.log(`[AIAcceptance] Successfully created pending record with id=${record.id}`);
      return { success: true, data: record };
    } catch (error) {
      this.err.log('errors.ai.acceptance_create');
      this.err.logWithDetail('errors.ai.acceptance_create', `context=${input.contextType}, productIds=${input.productIds?.length ?? 0}, sourceRefId=${input.sourceRefId}`);
      return this.err.fail('errors.ai.acceptance_create');
    }
  }

  async markAcceptedByAcceptanceId(
    aiAcceptanceId: string
  ): Promise<BaseResponse<AIAcceptance>> {
    return this.err.wrap(async () => {
      const where: any = { id: aiAcceptanceId };

      const record = await this.unitOfWork.AIAcceptanceRepo.findOne(where);
      if (!record) {
        return this.err.fail('errors.ai.acceptance_not_found');
      }

      this.logger.log(`[AIAcceptance] Marking record id=${aiAcceptanceId} as accepted`);
      await this.unitOfWork.AIAcceptanceRepo.assign(record, {
        isAccepted: true,
        clickedAt: new Date()
      });
      await this.unitOfWork.AIAcceptanceRepo.getEntityManager().flush();
      this.logger.log(`[AIAcceptance] Successfully marked record id=${aiAcceptanceId} as accepted`);

      return { success: true, data: record };
    }, 'errors.common.internal');
  }

  async getAllAIAcceptanceStatus(): Promise<BaseResponse<AIAcceptance[] | null>> {
    return this.err.wrap(
      async () => {
        const aiAcceptance = await this.unitOfWork.AIAcceptanceRepo.findAll({
          orderBy: { updatedAt: 'DESC' }
        });
        if (!aiAcceptance) {
          return this.err.fail('errors.ai.acceptance_not_found');
        }
        return { success: true, data: aiAcceptance };
      },
      'errors.common.internal'
    );
  }

  async getAIAcceptanceMetrics(
    contextType?: AIAcceptanceContextType
  ): Promise<BaseResponse<AIAcceptanceMetrics>> {
    return this.err.wrap(async () => {
      const where: any = {};
      if (contextType) where.contextType = contextType;

      const now = new Date();
      const records = await this.unitOfWork.AIAcceptanceRepo.find(where);

      const accepted = records.filter((record) => record.isAccepted).length;
      const pending = records.filter((record) => !record.isAccepted && !this.isVisibleRecord(record, now)).length;
      const noClick = records.filter((record) => !record.isAccepted && this.isVisibleRecord(record, now)).length;
      const totalForRate = accepted + noClick;

      const metrics: AIAcceptanceMetrics = {
        total: records.length,
        accepted,
        pending,
        noClick,
        acceptanceRate: totalForRate > 0 ? (accepted / totalForRate) * 100 : 0
      };

      return { success: true, data: metrics };
    }, 'errors.common.internal');
  }

  async createAndAttachAIAcceptanceToProducts<T extends Record<string, any>>(
    input: AttachAIAcceptanceToProductsInput<T>
  ): Promise<AttachAIAcceptanceToProductsResult<T>> {
    try {
      if (!Array.isArray(input.products) || input.products.length === 0) {
        this.logger.warn(`[AIAcceptance] No products to attach acceptance for context=${input.contextType}`);
        return { aiAcceptanceId: null, products: input.products ?? [] };
      }

      const productIds = this.extractProductIdsFromPayload(input.products as any[]);
      this.logger.log(`[AIAcceptance] Attaching acceptance for context=${input.contextType}, productCount=${productIds.length}, sourceRefId=${input.sourceRefId}`);
      
      const createResult = await this.createPendingResponseAcceptance({
        contextType: input.contextType,
        sourceRefId: input.sourceRefId,
        productIds,
        metadata: input.metadata,
        visibleInHours: input.visibleInHours
      });

      if (!createResult.success || !createResult.data?.id) {
        this.logger.warn(
          `[AIAcceptance] create pending failed for context=${input.contextType}; products kept without aiAcceptanceId. Error: ${createResult.error || 'Unknown error'}`
        );
        return { aiAcceptanceId: null, products: input.products };
      }

      const aiAcceptanceId = createResult.data.id;
      this.logger.log(`[AIAcceptance] Successfully created acceptance id=${aiAcceptanceId} for context=${input.contextType}`);
      
      const enrichedProducts = input.products.map((product) => ({
        ...product,
        aiAcceptanceId
      }));

      return { aiAcceptanceId, products: enrichedProducts as T[] };
    } catch (error) {
      this.err.log('errors.ai.acceptance_create');
      return { aiAcceptanceId: null, products: input.products ?? [] };
    }
  }

  async updateAIAcceptanceStatusById(
    id: string,
    isAccepted: boolean = false,
  ): Promise<BaseResponse<AIAcceptance>> {
    const userAIAcceptance = await this.unitOfWork.AIAcceptanceRepo.findOne({
      id
    });

    if (userAIAcceptance) {
      const updateData: any = {
        isAccepted,
        clickedAt: isAccepted ? new Date() : null
      };
      if (!isAccepted && !userAIAcceptance.visibleAfterAt) {
        updateData.visibleAfterAt = this.resolveVisibleAfterAt();
      }
      this.logger.log(`[AIAcceptance] Updating record id=${id} to isAccepted=${isAccepted}`);
      await this.unitOfWork.AIAcceptanceRepo.assign(
        userAIAcceptance,
        updateData
      );
      await this.unitOfWork.AIAcceptanceRepo.getEntityManager().flush();
      this.logger.log(`[AIAcceptance] Successfully updated record id=${id}`);
    } else {
      return this.err.fail('errors.ai.acceptance_not_found');
    }

    return {
      success: true,
      data: userAIAcceptance
    };
  }

  async getAIAcceptanceRateByAcceptanceStatus(
    isAccepted: boolean,
    contextType?: AIAcceptanceContextType
  ): Promise<BaseResponse<number>> {
    const where: any = {};
    if (contextType) where.contextType = contextType;

    const now = new Date();
    const records = await this.unitOfWork.AIAcceptanceRepo.find(where);
    const visibleRecords = records.filter((record) => record.isAccepted || this.isVisibleRecord(record, now));

    const totalCount = visibleRecords.length;
    if (totalCount === 0) return { success: true, data: 0 };

    const matchingCount = visibleRecords.filter((record) => record.isAccepted === isAccepted).length;
    const acceptanceRate = (matchingCount / totalCount) * 100;
    return { success: true, data: acceptanceRate };
  }
}
