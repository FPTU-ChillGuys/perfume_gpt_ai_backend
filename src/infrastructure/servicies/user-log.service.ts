import { UnitOfWork } from '../repositories/unit-of-work';
import { Injectable } from '@nestjs/common';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { funcHandlerAsync } from '../utils/error-handler';
import { PeriodEnum } from 'src/domain/enum/period.enum';
import {
  AllUserLogRequest,
  UserLogRequest
} from 'src/application/dtos/request/user-log.request';
import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear
} from 'date-fns';
import { convertToUTC } from '../utils/time-zone';
import { UserLogSummary } from 'src/domain/entities/user-log-summary';
import { UserLogSummaryResponse } from 'src/application/dtos/response/user-log-summary.response';
import { UserLogSummaryMapper } from 'src/application/mapping/custom/user-log-summary.mapper';
import { generateSummaryPrompt } from 'src/application/constant/prompts';
import { EventLog } from 'src/domain/entities/event-log.entity';
import {
  EventLogCreateRequest,
  EventLogPagedQueryRequest,
  EventLogQueryRequest,
  EventLogSummaryQueryRequest
} from 'src/application/dtos/request/event-log.request';
import { EventLogEventType } from 'src/domain/enum/event-log-event-type.enum';
import { EventLogSummaryResponse } from 'src/application/dtos/response/event-log-summary.response';
import {
  EventLogTimeSeriesPointResponse,
  EventLogTimeSeriesResponse
} from 'src/application/dtos/response/event-log-timeseries.response';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  QueueName,
  UserLogSummaryJobName
} from 'src/application/constant/processor';
import { tokenizeText } from '../utils/nlp-tokenizer';

@Injectable()
export class UserLogService {
  constructor(
    protected unitOfWork: UnitOfWork,
    @InjectQueue(QueueName.USER_LOG_SUMMARY_QUEUE)
    private readonly userLogSummaryQueue: Queue
  ) {}

  async enqueueRollingSummaryUpdate(userId: string): Promise<void> {
    if (!userId) {
      return;
    }

    const safeUserId = userId.replace(/:/g, '_');

    await this.userLogSummaryQueue.add(
      UserLogSummaryJobName.UPDATE_ROLLING_SUMMARY,
      { userId },
      {
        jobId: `rolling-summary-${safeUserId}`,
        delay: 10_000,
        removeOnComplete: true,
        removeOnFail: 200,
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 2_000
        }
      }
    );
  }

  /** Lay tat ca log */
  async getAllLogs(): Promise<BaseResponse<EventLog[]>> {
    return {
      success: false,
      error: 'Deprecated: user_log table has been removed. Use event log APIs instead.'
    };
  }

  async getAllEventLogs(): Promise<BaseResponse<EventLog[]>> {
    return await funcHandlerAsync(
      async () => {
        const eventLogs = await this.unitOfWork.EventLogRepo.getEventLogs({});
        return { success: true, data: eventLogs };
      },
      'Failed to get all event logs',
      true
    );
  }

  /** Lay event log moi */
  async getEventLogs(
    request: EventLogQueryRequest
  ): Promise<BaseResponse<EventLog[]>> {
    return await funcHandlerAsync(
      async () => {
        const eventLogs = await this.unitOfWork.EventLogRepo.getEventLogs({
          userId: request.userId,
          eventType: request.eventType,
          startDate: request.startDate
            ? startOfDay(convertToUTC(request.startDate))
            : undefined,
          endDate: request.endDate
            ? endOfDay(convertToUTC(request.endDate))
            : undefined
        });

        return { success: true, data: eventLogs };
      },
      'Failed to get event logs',
      true
    );
  }

  async getEventLogsPaged(
    request: EventLogPagedQueryRequest
  ): Promise<BaseResponse<PagedResult<EventLog>>> {
    return await funcHandlerAsync(
      async () => {
        const pageNumber = Math.max(Number(request.PageNumber) || 1, 1);
        const pageSize = Math.max(Number(request.PageSize) || 10, 1);

        const paged = await this.unitOfWork.EventLogRepo.getEventLogsPaged(
          {
            userId: request.userId,
            eventType: request.eventType,
            startDate: request.startDate
              ? startOfDay(convertToUTC(request.startDate))
              : undefined,
            endDate: request.endDate
              ? endOfDay(convertToUTC(request.endDate))
              : undefined
          },
          pageNumber,
          pageSize,
          request.IsDescending
        );

        return { success: true, data: paged };
      },
      'Failed to get paged event logs',
      true
    );
  }

  async createEventLog(
    request: EventLogCreateRequest
  ): Promise<BaseResponse<{ id: string }>> {
    return await funcHandlerAsync(
      async () => {
        const id = await this.unitOfWork.EventLogRepo.createEventLog({
          userId: request.userId,
          eventType: request.eventType,
          entityType: request.entityType,
          entityId: request.entityId,
          contentText: request.contentText,
          metadata: request.metadata
        });

        if (request.userId) {
          await this.enqueueRollingSummaryUpdate(request.userId);
        }

        return { success: true, data: { id } };
      },
      'Failed to create event log',
      true
    );
  }

  async getEventLogsSummary(
    request: EventLogSummaryQueryRequest
  ): Promise<BaseResponse<EventLogSummaryResponse>> {
    return await funcHandlerAsync(
      async () => {
        const eventLogs = await this.unitOfWork.EventLogRepo.getEventLogs({
          userId: request.userId,
          startDate: request.startDate
            ? startOfDay(convertToUTC(request.startDate))
            : undefined,
          endDate: request.endDate
            ? endOfDay(convertToUTC(request.endDate))
            : undefined
        });

        const messageCount = eventLogs.filter(
          (log) => log.eventType === EventLogEventType.MESSAGE
        ).length;
        const searchCount = eventLogs.filter(
          (log) => log.eventType === EventLogEventType.SEARCH
        ).length;
        const quizCount = eventLogs.filter(
          (log) => log.eventType === EventLogEventType.QUIZ
        ).length;

        return {
          success: true,
          data: {
            userId: request.userId,
            startDate: request.startDate,
            endDate: request.endDate,
            totalCount: eventLogs.length,
            messageCount,
            searchCount,
            quizCount
          }
        };
      },
      'Failed to summarize event logs',
      true
    );
  }

  async getEventLogsTimeSeries(
    request: EventLogSummaryQueryRequest
  ): Promise<BaseResponse<EventLogTimeSeriesResponse>> {
    return await funcHandlerAsync(
      async () => {
        const granularity = request.granularity || 'day';
        const eventLogs = await this.unitOfWork.EventLogRepo.getEventLogs({
          userId: request.userId,
          startDate: request.startDate
            ? startOfDay(convertToUTC(request.startDate))
            : undefined,
          endDate: request.endDate
            ? endOfDay(convertToUTC(request.endDate))
            : undefined
        });

        const buckets = new Map<string, EventLogTimeSeriesPointResponse>();

        const getBucketDate = (date: Date): Date => {
          return granularity === 'week' ? startOfWeek(date) : startOfDay(date);
        };

        for (const eventLog of eventLogs) {
          const bucketDate = getBucketDate(eventLog.createdAt);
          const bucketKey = bucketDate.toISOString();
          const existingBucket = buckets.get(bucketKey) || {
            bucketStart: bucketDate,
            totalCount: 0,
            messageCount: 0,
            searchCount: 0,
            quizCount: 0
          };

          existingBucket.totalCount += 1;
          if (eventLog.eventType === EventLogEventType.MESSAGE) {
            existingBucket.messageCount += 1;
          } else if (eventLog.eventType === EventLogEventType.SEARCH) {
            existingBucket.searchCount += 1;
          } else if (eventLog.eventType === EventLogEventType.QUIZ) {
            existingBucket.quizCount += 1;
          }

          buckets.set(bucketKey, existingBucket);
        }

        const points = Array.from(buckets.values()).sort(
          (a, b) => a.bucketStart.getTime() - b.bucketStart.getTime()
        );

        return {
          success: true,
          data: {
            userId: request.userId,
            startDate: request.startDate,
            endDate: request.endDate,
            granularity,
            points
          }
        };
      },
      'Failed to build event log time series',
      true
    );
  }

  private buildContentSectionsFromEvents(eventLogs: EventLog[]): {
    searchContents: string;
    messageContents: string;
    quizContents: string;
    count: number;
  } {
    const searchLogs = eventLogs.filter(
      (log) => log.eventType === EventLogEventType.SEARCH
    );
    const messageLogs = eventLogs.filter(
      (log) => log.eventType === EventLogEventType.MESSAGE
    );
    const quizLogs = eventLogs.filter(
      (log) => log.eventType === EventLogEventType.QUIZ
    );

    const searchContents =
      'Search: ' +
      searchLogs
        .map((log) =>
          log.contentText ||
          (typeof log.metadata?.query === 'string'
            ? (log.metadata.query as string)
            : '')
        )
        .filter(Boolean)
        .join(';\n');

    const messageContents =
      'Messages: ' +
      messageLogs
        .map((log) => log.contentText || '')
        .filter(Boolean)
        .join(';\n');

    const quizContents = quizLogs
      .map((log) => {
        const question =
          typeof log.metadata?.question === 'string'
            ? (log.metadata.question as string)
            : '';
        const answer =
          typeof log.metadata?.answer === 'string'
            ? (log.metadata.answer as string)
            : '';

        return `Question: ${question}\n Answer: ${answer}`.trim();
      })
      .filter(Boolean)
      .join('; ');

    return {
      searchContents,
      messageContents,
      quizContents,
      count: searchLogs.length + messageLogs.length + quizLogs.length
    };
  }

  private normalizeFeatureSnapshot(
    snapshot?: Record<string, unknown>
  ): Record<string, Record<string, number>> {
    const safe = (value: unknown): Record<string, number> => {
      if (!value || typeof value !== 'object') {
        return {};
      }

      const normalized: Record<string, number> = {};
      for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
        const numeric = Number(raw);
        if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
          normalized[key] = numeric;
        }
      }
      return normalized;
    };

    return {
      eventTypeCounts: safe(snapshot?.eventTypeCounts),
      keywordCounts: safe(snapshot?.keywordCounts),
      intentCounts: safe(snapshot?.intentCounts),
      audienceCounts: safe(snapshot?.audienceCounts),
      hourCounts: safe(snapshot?.hourCounts)
    };
  }

  private buildRollingSummaryText(
    featureSnapshot: Record<string, Record<string, number>>,
    totalEvents: number
  ): string {
    const topEntries = (obj: Record<string, number>, limit = 5): string =>
      Object.entries(obj)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([key, value]) => `${key} (${value})`)
        .join(', ');

    const topKeywords = topEntries(featureSnapshot.keywordCounts);
    const intents = topEntries(featureSnapshot.intentCounts, 3);
    const audiences = topEntries(featureSnapshot.audienceCounts, 3);
    const activeHours = topEntries(featureSnapshot.hourCounts, 3);
    const eventTypes = topEntries(featureSnapshot.eventTypeCounts, 3);

    return [
      `Total events: ${totalEvents}.`,
      `Top event types: ${eventTypes || 'n/a'}.`,
      `Top keywords: ${topKeywords || 'n/a'}.`,
      `Detected intents: ${intents || 'n/a'}.`,
      `Detected audiences: ${audiences || 'n/a'}.`,
      `Active hours: ${activeHours || 'n/a'}.`
    ].join(' ');
  }

  private increaseCounter(
    counters: Record<string, number>,
    key: string,
    amount = 1
  ): void {
    if (!key) {
      return;
    }
    counters[key] = (counters[key] || 0) + amount;
  }

  async rebuildRollingSummaryForUser(userId: string): Promise<void> {
    if (!userId) {
      return;
    }

    const existingSummary = await this.unitOfWork.UserLogSummaryRepo.findOne({ userId });
    const lastEventAt = existingSummary?.lastEventAt;

    const events = await this.unitOfWork.EventLogRepo.getEventLogs({
      userId,
      startDate: lastEventAt || undefined
    });

    const newEvents = events
      .filter((event) =>
        !lastEventAt || event.createdAt.getTime() > lastEventAt.getTime()
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    if (!newEvents.length) {
      return;
    }

    const featureSnapshot = this.normalizeFeatureSnapshot(existingSummary?.featureSnapshot);
    let totalEvents = existingSummary?.totalEvents || 0;
    let latestEventAt = existingSummary?.lastEventAt;

    for (const event of newEvents) {
      totalEvents += 1;
      latestEventAt = !latestEventAt || latestEventAt < event.createdAt
        ? event.createdAt
        : latestEventAt;

      this.increaseCounter(featureSnapshot.eventTypeCounts, event.eventType);
      this.increaseCounter(featureSnapshot.hourCounts, String(event.createdAt.getHours()));

      const textParts: string[] = [];
      if (event.contentText) {
        textParts.push(event.contentText);
      }

      if (typeof event.metadata?.question === 'string') {
        textParts.push(event.metadata.question as string);
      }
      if (typeof event.metadata?.answer === 'string') {
        textParts.push(event.metadata.answer as string);
      }

      const normalizedText = textParts.join(' ').toLowerCase();
      const keywords = tokenizeText(normalizedText);
      for (const keyword of keywords) {
        this.increaseCounter(featureSnapshot.keywordCounts, keyword);
      }

      if (/recommend|goi y|gợi ý|suggest/.test(normalizedText)) {
        this.increaseCounter(featureSnapshot.intentCounts, 'recommendation');
      }
      if (/buy|mua|order|don hang|đơn hàng/.test(normalizedText)) {
        this.increaseCounter(featureSnapshot.intentCounts, 'purchase');
      }
      if (/gift|qua tang|quà tặng/.test(normalizedText)) {
        this.increaseCounter(featureSnapshot.intentCounts, 'gift');
      }
      if (event.eventType === EventLogEventType.QUIZ) {
        this.increaseCounter(featureSnapshot.intentCounts, 'quiz_engagement');
      }

      if (/men|male|nam/.test(normalizedText)) {
        this.increaseCounter(featureSnapshot.audienceCounts, 'male');
      }
      if (/women|female|nu|nữ/.test(normalizedText)) {
        this.increaseCounter(featureSnapshot.audienceCounts, 'female');
      }
      if (/unisex/.test(normalizedText)) {
        this.increaseCounter(featureSnapshot.audienceCounts, 'unisex');
      }
    }

    const logSummary = this.buildRollingSummaryText(featureSnapshot, totalEvents);

    if (!existingSummary) {
      const newSummary = new UserLogSummary({
        userId,
        logSummary,
        featureSnapshot,
        totalEvents,
        lastEventAt: latestEventAt
      });
      await this.unitOfWork.UserLogSummaryRepo.insert(newSummary);
      return;
    }

    existingSummary.logSummary = logSummary;
    existingSummary.featureSnapshot = featureSnapshot;
    existingSummary.totalEvents = totalEvents;
    existingSummary.lastEventAt = latestEventAt;
    await this.unitOfWork.UserLogSummaryRepo.upsert(existingSummary);
  }

  /** Lay tat ca log */
  async getUserLogsWithPeriod(allUserLogRequest: AllUserLogRequest): Promise<BaseResponse<EventLog[]>> {
    return {
      success: false,
      error: 'Deprecated alias. Use event log APIs instead.',
      data: []
    };
  }

  async getEventLogsWithPeriod(
    allUserLogRequest: AllUserLogRequest
  ): Promise<BaseResponse<EventLog[]>> {
    return await funcHandlerAsync(
      async () => {
        if (!allUserLogRequest.startDate) {
          allUserLogRequest.startDate = this.getFirstDateOfPeriod(
            allUserLogRequest.period,
            convertToUTC(allUserLogRequest.endDate)
          );
        }

        const eventLogs = await this.unitOfWork.EventLogRepo.getEventLogs({
          startDate: convertToUTC(startOfDay(allUserLogRequest.startDate)),
          endDate: convertToUTC(endOfDay(allUserLogRequest.endDate))
        });

        return { success: true, data: eventLogs };
      },
      'Failed to get event logs with period',
      true
    );
  }



  /** Lay log tu userId */
  async getUserLogsByUserId(
    userId: string
  ): Promise<BaseResponse<EventLog[]>> {
    return {
      success: true,
      data: []
    };
  }

  async addUserSearch(
    searchText: string,
    userId: string
  ): Promise<BaseResponse<{ id: string }>> {
    return await funcHandlerAsync(async () => {
      const id = await this.unitOfWork.EventLogRepo.createSearchEvent(
        userId,
        searchText
      );
      await this.enqueueRollingSummaryUpdate(userId);
      return { success: true, data: { id } };
    }, 'Failed to add user search log');
  }

  async addSearchLogToUserLog(
    userId: string,
    searchText: string
  ): Promise<string> {
    const id = await this.unitOfWork.EventLogRepo.createSearchEvent(userId, searchText);
    await this.enqueueRollingSummaryUpdate(userId);
    return id;
  }

  async addProductViewLog(
    userId: string,
    productId: string,
    variantId?: string,
    productName?: string,
    variantName?: string
  ): Promise<string> {
    const id = await this.unitOfWork.EventLogRepo.createProductViewEvent(
      userId,
      productId,
      variantId,
      productName,
      variantName
    );
    await this.enqueueRollingSummaryUpdate(userId);
    return id;
  }

  async addSearchTextLog(
    userId: string,
    searchText: string
  ): Promise<string> {
    const id = await this.unitOfWork.EventLogRepo.createSearchEvent(userId, searchText);
    await this.enqueueRollingSummaryUpdate(userId);
    return id;
  }

  async addQuizQuesAnsDetailToUserLog(
    userId: string,
    quizQuesAnsId: string
  ): Promise<string[]> {
    const quizQuesAnsDetail =
      await this.unitOfWork.AIQuizQuestionAnswerRepo.findOne({
        id: quizQuesAnsId
      });

    const ids = await this.unitOfWork.EventLogRepo.createQuizEventsFromDetails(
      userId,
      quizQuesAnsDetail?.details.getItems() || []
    );

    if (ids.length) {
      await this.enqueueRollingSummaryUpdate(userId);
    }

    return ids;
  }

  async saveUserLogSummary(
    userId: string,
    summary: string,
    featureSnapshot?: Record<string, unknown>,
    lastEventAt?: Date
  ): Promise<BaseResponse<string>> {
    return await funcHandlerAsync(
      async () => {
        const existingSummary = await this.unitOfWork.UserLogSummaryRepo.findOne({ userId });
        if (!existingSummary) {
          const userLogSummary = new UserLogSummary({
            userId,
            logSummary: summary,
            lastEventAt,
            totalEvents: 0,
            featureSnapshot: featureSnapshot || {}
          });

          await this.unitOfWork.UserLogSummaryRepo.insert(userLogSummary);
          return { success: true, data: userLogSummary.logSummary };
        }

        existingSummary.logSummary = summary;
        existingSummary.lastEventAt = lastEventAt;
        existingSummary.featureSnapshot =
          featureSnapshot || existingSummary.featureSnapshot;
        await this.unitOfWork.UserLogSummaryRepo.upsert(existingSummary);
        return { success: true, data: existingSummary.logSummary };
      },
      'Failed to save user log summary',
      true
    );
  }

  async updateUserLogSummary(
    userId: string,
    startDate: Date,
    endDate: Date,
    summary: string
  ): Promise<BaseResponse<string>> {
    return await funcHandlerAsync(
      async () => {
        const existingSummary = await this.unitOfWork.UserLogSummaryRepo.findOne({ userId });
        if (!existingSummary) {
          return { success: false, error: 'User log summary not found' };
        }
        existingSummary.logSummary = summary;
        existingSummary.lastEventAt = endDate;
        this.unitOfWork.UserLogSummaryRepo.upsert(existingSummary);
        return { success: true, data: existingSummary.logSummary };

      },
      'Failed to update user log summary',
      true
    );
  }

  /** Lay summary tu userId */
  async getUserLogSummariesByUserId(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<BaseResponse<UserLogSummaryResponse[]>> {
    return await funcHandlerAsync(
      async () => {
        console.log(
          `Start Date: ${startDate ? startOfDay(convertToUTC(startDate)) : new Date(0)
          }, End Date: ${endDate ? endOfDay(convertToUTC(endDate)) : endOfDay(new Date())
          }`
        );

        const userLogSummary = await this.unitOfWork.UserLogSummaryRepo.findOne({
          userId: userId
        });
        if (!userLogSummary) {
          return { success: false, error: 'User log summary not found' };
        }
        return {
          success: true,
          data: [UserLogSummaryMapper.toResponse(userLogSummary)]
        };
      },
      'Failed to get user log summary',
      true
    );
  }

  // Tao report tu cac user log summary
  async getUserLogSummaryReportByUserId(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<BaseResponse<string>> {
    return await funcHandlerAsync(
      async () => {
        const userLogSummaries = await this.getUserLogSummariesByUserId(
          userId,
          startDate,
          endDate
        );
        if (!userLogSummaries.success || !userLogSummaries.data) {
          return { success: false, error: 'User log summaries not found' };
        }
        // Tao data tu cac log summary
        const data = userLogSummaries.data
          .map((summary) => summary.logSummary)
          .join('\n');

        // Tao report
        const report = `User Log Summary Report from ${startDate ? convertToUTC(startDate) : 'the beginning'} to ${endDate ? convertToUTC(endDate) : new Date().toISOString()
          }:\n${data}`;

        return { success: true, data: report };
      },
      'Failed to get user log summary report',
      true
    );
  }

  // Tong hop cac log cua user trong mot khoang thoi gian
  async getReportAndPromptSummaryUserLogs(
    userLogRequest: UserLogRequest
  ): Promise<
    BaseResponse<{ prompt: string; response: string; count: number }>
  > {
    return await funcHandlerAsync(
      async () => {
        // Xu ly neu khong co startDate thi lay theo period
        if (!userLogRequest.startDate) {
          userLogRequest.startDate = this.getFirstDateOfPeriod(
            userLogRequest.period,
            convertToUTC(userLogRequest.endDate)
          );
        }

        // Lay log cua user trong khoang thoi gian
        const eventLogs = await this.unitOfWork.EventLogRepo.getEventLogs(
          {
            userId: userLogRequest.userId,
            startDate: startOfDay(convertToUTC(userLogRequest.startDate!)),
            endDate: endOfDay(convertToUTC(userLogRequest.endDate))
          }
        );

        if (!eventLogs.length) {
          return { success: false, error: 'User log not found' };
        }

        const { searchContents, messageContents, quizContents, count } =
          this.buildContentSectionsFromEvents(eventLogs);

        console.log(`User ID: ${userLogRequest.userId}`);
        console.log(`Search Contents: ${searchContents}`);
        console.log(`Message Contents: ${messageContents}`);
        console.log(`Quiz Contents: ${quizContents}`);

        // Tao prompt de tong hop log
        const prompt = generateSummaryPrompt(
          searchContents,
          messageContents,
          quizContents,
          startOfDay(convertToUTC(userLogRequest.startDate!)),
          endOfDay(convertToUTC(userLogRequest.endDate))
        );

        // Tao response tu cac log
        const response = this.convertUserLogsToReport(
          searchContents,
          messageContents,
          quizContents,
          startOfDay(convertToUTC(userLogRequest.startDate!)),
          endOfDay(convertToUTC(userLogRequest.endDate))
        );

        return { success: true, data: { prompt, response, count } };
      },
      'Failed to summarize user logs',
      true
    );
  }

  // Tong hop cac log cua user trong mot khoang thoi gian
  async getReportAndPromptSummaryAllUsersLogs(
    allUserLogRequest: AllUserLogRequest
  ): Promise<BaseResponse<{ prompt: string; response: string }>> {
    return await funcHandlerAsync(async () => {
      if (!allUserLogRequest.startDate) {
        allUserLogRequest.startDate = this.getFirstDateOfPeriod(
          allUserLogRequest.period,
          allUserLogRequest.endDate
        );
      }

      console.log(`Period: ${allUserLogRequest.period}`);
      console.log(`Start Date: ${allUserLogRequest.startDate}`);
      console.log(`End Date: ${allUserLogRequest.endDate}`);

      const eventLogs = await this.unitOfWork.EventLogRepo.getEventLogs({
        startDate: startOfDay(convertToUTC(allUserLogRequest.startDate!)),
        endDate: endOfDay(convertToUTC(allUserLogRequest.endDate))
      });

      const groupedByUserId = new Map<string, EventLog[]>();
      eventLogs.forEach((eventLog) => {
        const key = eventLog.userId || 'anonymous';
        const currentLogs = groupedByUserId.get(key) || [];
        currentLogs.push(eventLog);
        groupedByUserId.set(key, currentLogs);
      });

      let prompt = '';
      let response = '';

      for (const [userId, userEventLogs] of groupedByUserId.entries()) {
        const { searchContents, messageContents, quizContents } =
          this.buildContentSectionsFromEvents(userEventLogs);

        console.log(`User ID: ${userId}`);
        console.log(`Search Contents: ${searchContents}`);
        console.log(`Message Contents: ${messageContents}`);
        console.log(`Quiz Contents: ${quizContents}`);

        // Tao prompt de tong hop log
        prompt +=
          generateSummaryPrompt(
            searchContents,
            messageContents,
            quizContents,
            startOfDay(convertToUTC(allUserLogRequest.startDate!)),
            endOfDay(convertToUTC(allUserLogRequest.endDate))
          ) + '\n';

        response +=
          this.convertUserLogsToReport(
            searchContents,
            messageContents,
            quizContents,
            startOfDay(convertToUTC(allUserLogRequest.startDate!)),
            endOfDay(convertToUTC(allUserLogRequest.endDate))
          ) + '\n';
      }

      return { success: true, data: { prompt, response } };
    }, 'Failed to summarize user logs', true);
  }

  // Tam thoi lay tat ca userId tu log
  async getAllUserIdsFromLogs(): Promise<string[]> {
    const userIds = await this.unitOfWork.EventLogRepo.getDistinctUserIds();
    return Array.from(new Set(userIds));
  }

  getFirstDateOfPeriod(period: PeriodEnum, endDate: Date): Date {
    const endDateObj = new Date(endDate);
    let startDate = new Date(endDateObj);
    if (period === PeriodEnum.WEEKLY) {
      startDate = new Date(endDateObj);
      startDate.setDate(endDateObj.getDate() - 7);
    } else if (period === PeriodEnum.MONTHLY) {
      startDate = new Date(endDateObj);
      startDate.setMonth(endDateObj.getMonth() - 1);
    } else if (period === PeriodEnum.YEARLY) {
      startDate = new Date(endDateObj);
      startDate.setFullYear(endDateObj.getFullYear() - 1);
    } else {
      throw new Error('Invalid period enum');
    }
    return startDate;
  }

  // Chuyen doi cac log nguoi dung thanh chuoi de tao report
  convertUserLogsToReport(
    searchContents: string,
    messageContents: string,
    quizContents: string,
    startDate: Date,
    endDate: Date
  ): string {
    const response = `User activity summary from ${startOfDay(new Date(startDate))} to ${endOfDay(new Date(endDate))}:\n
    Search Activities: ${searchContents}\n
    Messages: ${messageContents}\n
    Quiz Answers: ${quizContents}\n`;
    return response;
  }


  /** Kiem tra neu co log trong tuan khong bat dau tu chu nhat luc 23:59 */
  async isLogsFromLastWeek(userId: string): Promise<boolean> {
    const response = await this.getReportAndPromptSummaryUserLogs(
      new UserLogRequest({
        userId,
        period: PeriodEnum.WEEKLY,
        endDate: endOfWeek(convertToUTC(new Date()))
      })
    );
    if (!response.success) {
      console.log(`Failed to get user logs for userId: ${userId}`);
      return false;
    }
    return response.data?.count! > 0;
  }

  /** Kiem tra neu co log trong thang khong */
  async isLogsFromLastMonth(userId: string): Promise<boolean> {
    const response = await this.getReportAndPromptSummaryUserLogs(
      new UserLogRequest({
        userId,
        period: PeriodEnum.MONTHLY,
        endDate: endOfMonth(convertToUTC(new Date()))
      })
    );
    if (!response.success) {
      console.log(`Failed to get user logs for userId: ${userId}`);
      return false;
    }
    return response.data?.count! > 0;
  }

  /** Kiem tra neu co log trong nam khong */
  async isLogsFromLastYear(userId: string): Promise<boolean> {
    const response = await this.getReportAndPromptSummaryUserLogs(
      new UserLogRequest({
        userId,
        period: PeriodEnum.YEARLY,
        endDate: endOfYear(convertToUTC(new Date()))
      })
    );
    if (!response.success) {
      console.log(`Failed to get user logs for userId: ${userId}`);
      return false;
    }
    return response.data?.count! > 0;
  }

  /** Lay log tu userId */
  async getUserLogs(userId: string, endDate?: Date, startDate?: Date): Promise<BaseResponse<EventLog[]>> {
    return {
      success: true,
      data: []
    };
  }

  /** Lay log tu userId theo tuan */
  async getUserLogsByWeek(userId: string): Promise<BaseResponse<EventLog[]>> {
    const endDate = endOfWeek(convertToUTC(new Date()));
    const startDate = startOfWeek(convertToUTC(new Date()));
    return this.getUserLogs(userId, endDate, startDate);
  }

  /** Lay log tu userId theo thang */
  async getUserLogsByMonth(userId: string): Promise<BaseResponse<EventLog[]>> {
    const endDate = endOfMonth(convertToUTC(new Date()));
    const startDate = startOfMonth(convertToUTC(new Date(endDate)));
    return this.getUserLogs(userId, endDate, startDate);
  }

  /** Lay log tu userId theo nam */
  async getUserLogsByYear(userId: string): Promise<BaseResponse<EventLog[]>> {
    const endDate = endOfYear(convertToUTC(new Date()));
    const startDate = startOfYear(convertToUTC(new Date(endDate)));
    return this.getUserLogs(userId, endDate, startDate);
  }

  /** Lay user log summary tu userId */
  async getUserLogSummaryByUserId(userId: string, startDate?: Date, endDate?: Date): Promise<BaseResponse<UserLogSummary | null>> {
    return funcHandlerAsync(
      async () => {
        const userLogSummary = await this.unitOfWork.UserLogSummaryRepo.findOne({
          userId: userId
        });

        if (!userLogSummary) {
          return { success: false, error: 'User log summary not found', data: null };
        }
        return { success: true, data: userLogSummary };
      },
      'Failed to get user log summary',
      true
    );
  }

  async getAllUserLogSummary(allUserLogRequest: AllUserLogRequest): Promise<BaseResponse<UserLogSummary[] | null>> {
    return funcHandlerAsync(
      async () => {
        const userLogSummary = await this.unitOfWork.UserLogSummaryRepo.find(
          {},
          { orderBy: { updatedAt: 'DESC' } }
        );

        if (!userLogSummary) {
          return { success: false, error: 'User log summary not found', data: null };
        }
        return { success: true, data: userLogSummary };
      },
      'Failed to get user log summary',
      true
    );
  }

  async getAllUserLogSummaryReport(allUserLogRequest: AllUserLogRequest): Promise<BaseResponse<string | null>> {
    return funcHandlerAsync(
      async () => {
        const summaries = await this.getAllUserLogSummary(allUserLogRequest);
        if (!summaries.success) {
          return { success: false, error: 'User log summary not found', data: null };
        }

        const report = summaries.data?.map(summary => summary.logSummary).join('\n');
        return { success: true, data: report };
      },
      'Failed to get user log summary report',
      true
    );
  }


  /** Lay user summary theo tuan */
  async getUserLogSummaryByWeek(userId: string): Promise<BaseResponse<UserLogSummary | null>> {
    const currentDate = new Date();
    const endDate = endOfWeek(convertToUTC(currentDate));
    const startDate = startOfWeek(convertToUTC(currentDate));
    return this.getUserLogSummaryByUserId(userId, startDate, endDate);
  }

  /** Lay user summary theo thang */
  async getUserLogSummaryByMonth(userId: string): Promise<BaseResponse<UserLogSummary | null>> {
    const currentDate = new Date();
    const endDate = endOfMonth(convertToUTC(currentDate));
    const startDate = startOfMonth(convertToUTC(currentDate));
    return this.getUserLogSummaryByUserId(userId, startDate, endDate);
  }

  /** Lay user summary theo nam */
  async getUserLogSummaryByYear(userId: string): Promise<BaseResponse<UserLogSummary | null>> {
    const currentDate = new Date();
    const endDate = endOfYear(convertToUTC(currentDate));
    const startDate = startOfYear(convertToUTC(currentDate));
    return this.getUserLogSummaryByUserId(userId, startDate, endDate);
  }

  /** Tong hop log va goi AI, tra ve chuoi ket qua (dung cho controller) */
  // AI methods moved to UserLogAIService
}

