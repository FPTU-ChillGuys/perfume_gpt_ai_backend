import { SqlEntityRepository } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { EventLog } from 'src/domain/entities/event-log.entity';
import { Message } from 'src/domain/entities/message.entity';
import { QuizQuestionAnswerDetail } from 'src/domain/entities/quiz-question-answer-detail.entity';
import { EventLogEntityType } from 'src/domain/enum/event-log-entity-type.enum';
import { EventLogEventType } from 'src/domain/enum/event-log-event-type.enum';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';

export type EventLogQuery = {
  userId?: string;
  eventType?: EventLogEventType;
  startDate?: Date;
  endDate?: Date;
};

@Injectable()
export class EventLogRepository extends SqlEntityRepository<EventLog> {
  async createEventLog(event: Partial<EventLog>): Promise<string> {
    const record = new EventLog(event);
    await this.getEntityManager().persistAndFlush(record);
    return record.id;
  }

  async createSearchEvent(userId: string, searchText: string): Promise<string> {
    return this.createEventLog({
      userId,
      eventType: EventLogEventType.SEARCH,
      entityType: EventLogEntityType.SEARCH,
      contentText: searchText,
      metadata: {
        source: 'user_search'
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

  async createQuizEventsFromDetails(
    userId: string,
    quizQuesAnsDetails: QuizQuestionAnswerDetail[]
  ): Promise<string[]> {
    const detailIds = quizQuesAnsDetails.map((item) => item.id);
    if (!detailIds.length) {
      return [];
    }

    const existingEventLogs = await this.find({
      eventType: EventLogEventType.QUIZ,
      entityId: { $in: detailIds }
    });

    const existingDetailIds = new Set(
      existingEventLogs
        .map((item) => item.entityId)
        .filter((id): id is string => typeof id === 'string')
    );

    const eventLogs = quizQuesAnsDetails
      .filter((detail) => !existingDetailIds.has(detail.id))
      .map(
        (detail) =>
          new EventLog({
            userId,
            eventType: EventLogEventType.QUIZ,
            entityType: EventLogEntityType.QUIZ,
            entityId: detail.id,
            metadata: {
              questionId: detail.question?.id,
              question: detail.question?.question,
              answerId: detail.answer?.id,
              answer: detail.answer?.answer
            }
          })
      );

    if (!eventLogs.length) {
      return [];
    }

    await this.getEntityManager().persistAndFlush(eventLogs);
    return eventLogs.map((item) => item.id);
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
