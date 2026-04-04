import { SqlEntityRepository } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { EventLog } from 'src/domain/entities/event-log.entity';
import { Message } from 'src/domain/entities/message.entity';
import { SurveyQuestionAnswerDetail } from 'src/domain/entities/survey-question-answer-detail.entity';
import { EventLogEntityType } from 'src/domain/enum/event-log-entity-type.enum';
import { EventLogEventType } from 'src/domain/enum/event-log-event-type.enum';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import { BadRequestException } from '@nestjs/common';

export type EventLogQuery = {
  userId?: string;
  eventType?: EventLogEventType;
  startDate?: Date;
  endDate?: Date;
};

@Injectable()
export class EventLogRepository extends SqlEntityRepository<EventLog> {
  async createEventLog(event: Partial<EventLog>): Promise<string> {
    this.validateEventPayload(event);
    const record = new EventLog(event);
    await this.upsert(record);
    return record.id;
  }

  async createSearchEvent(userId: string, searchText: string): Promise<string> {
    return this.createEventLog({
      userId,
      eventType: EventLogEventType.SEARCH,
      entityType: EventLogEntityType.SEARCH,
      contentText: searchText,
      metadata: {
        source: 'user_search',
        keyword: searchText
      }
    });
  }

  async createProductViewEvent(
    userId: string,
    productId: string,
    variantId?: string,
    productName?: string,
    variantName?: string,
    extraMetadata?: Record<string, unknown>
  ): Promise<string> {
    return this.createEventLog({
      userId,
      eventType: EventLogEventType.PRODUCT,
      entityType: EventLogEntityType.PRODUCT,
      entityId: productId,
      metadata: {
        source: 'product_view',
        ...(variantId ? { variantId } : {}),
        ...(productName ? { productName } : {}),
        ...(variantName ? { variantName } : {}),
        ...(extraMetadata || {})
      }
    });
  }

  async createMessageEvent(userId: string, message: Message): Promise<string> {
    return this.createEventLog({
      userId,
      eventType: EventLogEventType.MESSAGE,
      entityType: EventLogEntityType.CONVERSATION,
      entityId: message.id,
      contentText: message.message,
      metadata: {
        sender: message.sender
      }
    });
  }

  async createSurveyEventsFromDetails(
    userId: string | undefined,
    surveyQuesAnsDetails: SurveyQuestionAnswerDetail[]
  ): Promise<string[]> {
    const detailIds = surveyQuesAnsDetails.map((item) => item.id);
    if (!detailIds.length) {
      return [];
    }

    const existingEventLogs = await this.find({
      eventType: EventLogEventType.SURVEY,
      entityId: { $in: detailIds }
    });

    const existingDetailIds = new Set(
      existingEventLogs
        .map((item) => item.entityId)
        .filter((id): id is string => typeof id === 'string')
    );

    const eventLogs = surveyQuesAnsDetails
      .filter((detail) => !existingDetailIds.has(detail.id))
      .map(
        (detail) => {
          const answerPayload = {
            questionId: detail.question?.id,
            question: detail.question?.question,
            answerId: detail.answer?.id,
            answer: detail.answer?.answer
          };

          return (
          new EventLog({
            userId,
            eventType: EventLogEventType.SURVEY,
            entityType: EventLogEntityType.SURVEY,
            entityId: detail.id,
            metadata: {
              source: 'survey_submitted',
              ...answerPayload,
              answers: [answerPayload]
            }
          })
          );
        }
      );

    if (!eventLogs.length) {
      return [];
    }

    await this.getEntityManager().upsert(eventLogs);
    return eventLogs.map((item) => item.id);
  }

  private validateEventPayload(event: Partial<EventLog>): void {
    if (!event.eventType) {
      throw new BadRequestException('eventType is required');
    }

    if (!event.entityType) {
      throw new BadRequestException('entityType is required');
    }

    const expectedEntityTypeMap: Record<EventLogEventType, EventLogEntityType> = {
      [EventLogEventType.MESSAGE]: EventLogEntityType.CONVERSATION,
      [EventLogEventType.SEARCH]: EventLogEntityType.SEARCH,
      [EventLogEventType.SURVEY]: EventLogEntityType.SURVEY,
      [EventLogEventType.PRODUCT]: EventLogEntityType.PRODUCT
    };

    const expectedEntityType = expectedEntityTypeMap[event.eventType];
    if (event.entityType !== expectedEntityType) {
      throw new BadRequestException(
        `Invalid entityType for ${event.eventType}. Expected ${expectedEntityType}`
      );
    }

    if (
      (event.eventType === EventLogEventType.MESSAGE ||
        event.eventType === EventLogEventType.SEARCH) &&
      (!event.contentText || !event.contentText.trim())
    ) {
      throw new BadRequestException(
        `contentText is required for ${event.eventType} events`
      );
    }

    if (event.eventType === EventLogEventType.PRODUCT && !event.entityId) {
      throw new BadRequestException('entityId is required for product events');
    }

    if (event.eventType === EventLogEventType.SURVEY && !event.metadata) {
      throw new BadRequestException('metadata is required for survey events');
    }
  }

  private buildWhere(query: EventLogQuery): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.eventType) {
      where.eventType = query.eventType;
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};

      if (query.startDate) {
        (where.createdAt as Record<string, unknown>).$gte = query.startDate;
      }

      if (query.endDate) {
        (where.createdAt as Record<string, unknown>).$lte = query.endDate;
      }
    }

    return where;
  }

  async getEventLogs(query: EventLogQuery): Promise<EventLog[]> {
    const where = this.buildWhere(query);

    return this.find(where, {
      orderBy: { createdAt: 'DESC' }
    });
  }

  async getEventLogsPaged(
    query: EventLogQuery,
    pageNumber: number,
    pageSize: number,
    isDescending: boolean
  ): Promise<PagedResult<EventLog>> {
    const where = this.buildWhere(query);
    const [items, totalCount] = await this.findAndCount(where, {
      limit: pageSize,
      offset: (pageNumber - 1) * pageSize,
      orderBy: { createdAt: isDescending ? 'DESC' : 'ASC' }
    });

    const totalPages = Math.ceil(totalCount / pageSize) || 1;

    return new PagedResult<EventLog>({
      items,
      pageNumber,
      pageSize,
      totalCount,
      totalPages
    });
  }

  async getDistinctUserIds(): Promise<string[]> {
    const rows = await this.getEntityManager().getConnection().execute<
      Array<{ user_id: string }>
    >('select distinct user_id from event_log where user_id is not null');

    return rows.map((row) => row.user_id).filter(Boolean);
  }
}
