import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { UnitOfWork } from 'src/infrastructure/domain/repositories/unit-of-work';
import { AIAcceptance } from 'src/domain/entities/ai-acceptance.entities';
import { Injectable, Logger } from '@nestjs/common';
import { funcHandlerAsync } from 'src/infrastructure/domain/utils/error-handler';
import { v4 as uuid } from 'uuid';
import { AIAcceptanceContextType, AI_ACCEPTANCE_DEFAULT_VISIBLE_HOURS } from 'src/infrastructure/domain/ai-acceptance/ai-acceptance.constants';

export interface CreatePendingAIAcceptanceInput {
  userId?: string | null;
  contextType: AIAcceptanceContextType;
  sourceRefId?: string | null;
  productIds?: string[];
  metadata?: Record<string, unknown> | null;
  visibleInHours?: number;
  cartItemId?: string | null;
}

export interface AttachAIAcceptanceToProductsInput<T = any> {
  userId?: string | null;
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

  constructor(private unitOfWork: UnitOfWork) { }

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
        userId: input.userId ?? null,
        isAccepted: false,
        cartItemId: input.cartItemId ?? null,
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
      this.logger.error('[AIAcceptance] createPendingResponseAcceptance failed', error);
      this.logger.error(`[AIAcceptance] Input details: context=${input.contextType}, productIds=${input.productIds?.length ?? 0}, sourceRefId=${input.sourceRefId}`);
      return { success: false, error: 'Failed to create pending AI acceptance record', details: error instanceof Error ? error.message : String(error) };
    }
  }

  async markAcceptedByAcceptanceId(
    aiAcceptanceId: string,
    userId?: string | null
  ): Promise<BaseResponse<AIAcceptance>> {
    return await funcHandlerAsync(async () => {
      const where: any = { id: aiAcceptanceId };
      if (userId) where.userId = userId;

      const record = await this.unitOfWork.AIAcceptanceRepo.findOne(where);
      if (!record) {
        return { success: false, error: 'AIAcceptance record not found' };
      }

      await this.unitOfWork.AIAcceptanceRepo.assign(record, {
        isAccepted: true,
        clickedAt: new Date()
      });
      await this.unitOfWork.AIAcceptanceRepo.getEntityManager().flush();

      return { success: true, data: record };
    }, 'Failed to mark AI acceptance as accepted');
  }

  async getVisibleAIAcceptanceByUserId(
    userId: string,
    contextType?: AIAcceptanceContextType
  ): Promise<BaseResponse<AIAcceptance[]>> {
    return await funcHandlerAsync(async () => {
      const where: any = { userId };
      if (contextType) where.contextType = contextType;

      const records = await this.unitOfWork.AIAcceptanceRepo.find(where, {
        orderBy: { updatedAt: 'DESC' }
      });

      const visible = records.filter((record) => this.isVisibleRecord(record));
      return { success: true, data: visible };
    }, 'Failed to get visible AI acceptance records');
  }

  async getAIAcceptanceMetrics(
    contextType?: AIAcceptanceContextType,
    userId?: string
  ): Promise<BaseResponse<AIAcceptanceMetrics>> {
    return await funcHandlerAsync(async () => {
      const where: any = {};
      if (contextType) where.contextType = contextType;
      if (userId) where.userId = userId;

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
    }, 'Failed to get AI acceptance metrics');
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
        userId: input.userId,
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
      this.logger.error('[AIAcceptance] createAndAttachAIAcceptanceToProducts failed', error);
      return { aiAcceptanceId: null, products: input.products ?? [] };
    }
  }

  async updateAIAcceptanceStatusById(
    id: string,
    cartItemId?: string | null,
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
      if (cartItemId !== undefined) {
        updateData.cartItemId = cartItemId;
      }
      if (!isAccepted && !userAIAcceptance.visibleAfterAt) {
        updateData.visibleAfterAt = this.resolveVisibleAfterAt();
      }
      await this.unitOfWork.AIAcceptanceRepo.assign(
        userAIAcceptance,
        updateData
      );
      await this.unitOfWork.AIAcceptanceRepo.getEntityManager().flush();
    } else {
      return { success: false, error: 'AIAcceptance record not found' };
    }

    return {
      success: true,
      data: userAIAcceptance
    };
  }

  async updateAIAcceptanceByUserIdAndCartId(
    userId: string,
    cartItemId?: string | null,
    isAccepted: boolean = false
  ): Promise<BaseResponse<AIAcceptance>> {
    const userAIAcceptance = await this.unitOfWork.AIAcceptanceRepo.findOne({
      userId,
      cartItemId
    });

    if (userAIAcceptance) {
      const updateData: any = {
        isAccepted,
        clickedAt: isAccepted ? new Date() : null
      };
      if (cartItemId !== undefined) {
        updateData.cartItemId = cartItemId;
      }
      if (!isAccepted && !userAIAcceptance.visibleAfterAt) {
        updateData.visibleAfterAt = this.resolveVisibleAfterAt();
      }
      await this.unitOfWork.AIAcceptanceRepo.assign(
        userAIAcceptance,
        updateData
      );
      await this.unitOfWork.AIAcceptanceRepo.getEntityManager().flush();
    } else {
      return { success: false, error: 'AIAcceptance record not found' };
    }

    return {
      success: true,
      data: userAIAcceptance
    };
  }

  async createAIAcceptanceRecord(
    userId: string,
    isAccepted: boolean,
    cartItemId?: string | null
  ): Promise<BaseResponse<AIAcceptance>> {
    const newAIAcceptance = new AIAcceptance({
      userId,
      isAccepted,
      cartItemId,
      contextType: 'cart_legacy',
      responseId: uuid(),
      sourceRefId: cartItemId ?? null,
      productIdsJson: cartItemId ? JSON.stringify([cartItemId]) : null,
      visibleAfterAt: isAccepted ? new Date() : this.resolveVisibleAfterAt(),
      clickedAt: isAccepted ? new Date() : null
    });
    await this.unitOfWork.AIAcceptanceRepo.insert(newAIAcceptance);
    return { success: true, data: newAIAcceptance };
  }

  async getAIAcceptanceByUserId(
    userId: string
  ): Promise<BaseResponse<AIAcceptance[] | null>> {
    const visibleResult = await this.getVisibleAIAcceptanceByUserId(userId);
    if (!visibleResult.success) {
      return { success: false, error: visibleResult.error ?? 'AIAcceptance record not found' };
    }
    return { success: true, data: visibleResult.data ?? [] };
  }

  async getAllAIAcceptanceStatus(): Promise<
    BaseResponse<AIAcceptance[] | null>
  > {
    return await funcHandlerAsync(
      async () => {
        const aiAcceptance = await this.unitOfWork.AIAcceptanceRepo.findAll({
          orderBy: { updatedAt: 'DESC' }
        });
        if (!aiAcceptance) {
          return { success: false, error: 'AIAcceptance record not found' };
        }
        return { success: true, data: aiAcceptance };
      },
      'Failed to retrieve AI acceptance records',
      true
    );
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

  async getAIAcceptanceRateByAcceptanceStatusWithUserId(
    userId: string,
    contextType?: AIAcceptanceContextType
  ): Promise<BaseResponse<number>> {
    const where: any = { userId };
    if (contextType) where.contextType = contextType;

    const records = await this.unitOfWork.AIAcceptanceRepo.find(where);
    const now = new Date();
    const visibleRecords = records.filter((record) => record.isAccepted || this.isVisibleRecord(record, now));
    if (visibleRecords.length === 0) {
      return { success: true, data: 0 };
    }

    const acceptedCount = visibleRecords.filter((a) => a.isAccepted === true).length;
    const acceptanceRate = (acceptedCount / visibleRecords.length) * 100;

    return { success: true, data: acceptanceRate };
  }
}
