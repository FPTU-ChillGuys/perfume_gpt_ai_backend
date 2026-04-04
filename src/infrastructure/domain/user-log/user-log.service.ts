import { UnitOfWork } from 'src/infrastructure/domain/repositories/unit-of-work';
import { Injectable, Logger } from '@nestjs/common';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { funcHandlerAsync } from 'src/infrastructure/domain/utils/error-handler';
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
import { convertToUTC } from 'src/infrastructure/domain/utils/time-zone';
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
import {
  applyEventToDailyFeatureSnapshot,
  applyEventToFeatureSnapshot,
  buildContentSectionsFromEvents,
  buildDailyLogSummaryMap,
  buildRollingSummaryText,
  buildSummaryResponseFromEvents,
  convertUserLogsToReport,
  getFirstDateOfPeriod,
  mergeDailyFeatureSnapshots,
  mergeFeatureSnapshots,
  normalizeDailyFeatureSnapshot,
  normalizeFeatureSnapshot,
  resolveAllUserLogRange
} from 'src/infrastructure/domain/utils/user-log-summary.util';

@Injectable()
export class UserLogService {
  private readonly logger = new Logger(UserLogService.name);

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
    this.logger.debug(`[SUMMARY-QUEUE] Enqueue rolling summary update for userId=${userId}`);

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
      error:
        'Deprecated: user_log table has been removed. Use event log APIs instead.'
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
        this.logger.debug(
          `[EVENT-LOG] Creating event log type=${request.eventType}, entityType=${request.entityType}, userId=${request.userId || 'anonymous'}`
        );

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
        const surveyCount = eventLogs.filter(
          (log) => log.eventType === EventLogEventType.SURVEY
        ).length;
        const productCount = eventLogs.filter(
          (log) => log.eventType === EventLogEventType.PRODUCT
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
            surveyCount,
            productCount
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
            surveyCount: 0,
            productCount: 0
          };

          existingBucket.totalCount += 1;
          if (eventLog.eventType === EventLogEventType.MESSAGE) {
            existingBucket.messageCount += 1;
          } else if (eventLog.eventType === EventLogEventType.SEARCH) {
            existingBucket.searchCount += 1;
          } else if (eventLog.eventType === EventLogEventType.SURVEY) {
            existingBucket.surveyCount += 1;
          } else if (eventLog.eventType === EventLogEventType.PRODUCT) {
            existingBucket.productCount += 1;
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

  async rebuildRollingSummaryForUser(userIdRaw: string): Promise<void> {
    if (!userIdRaw) {
      return;
    }

    const userId = userIdRaw.toLowerCase();
    this.logger.log(`[SUMMARY] Rebuild start for userId=${userId}`);

    const existingSummary = await this.unitOfWork.UserLogSummaryRepo.findOne({ userId });

    this.logger.log(
      `[SUMMARY] Existing summary=${existingSummary ? 'yes' : 'no'}, mode=full-rebuild`
    );

    const events = await this.unitOfWork.EventLogRepo.getEventLogs({ userId });
    const sortedEvents = [...events].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );

    this.logger.log(`[SUMMARY] Loaded events=${sortedEvents.length}`);

    if (!sortedEvents.length) {
      this.logger.log(`[SUMMARY] No events found for userId=${userId}, skip rebuild`);
      return;
    }

    const featureSnapshot = normalizeFeatureSnapshot();
    const dailyFeatureSnapshot = normalizeDailyFeatureSnapshot();
    let totalEvents = 0;

    for (const event of sortedEvents) {
      totalEvents += 1;
      applyEventToFeatureSnapshot(featureSnapshot, event);
      applyEventToDailyFeatureSnapshot(dailyFeatureSnapshot, event);
    }

    const logSummary = buildRollingSummaryText(featureSnapshot, totalEvents);
    const dailyLogSummary = buildDailyLogSummaryMap(dailyFeatureSnapshot);

    this.logger.log(
      `[SUMMARY] Built summary for userId=${userId}: ${logSummary}`
    );

    if (!existingSummary) {
      // For new summary, createdAt should be the first event's time
      const createdAt = sortedEvents.length > 0
        ? sortedEvents[0].createdAt
        : new Date();
      
      const newSummary = new UserLogSummary({
        userId,
        logSummary,
        featureSnapshot,
        dailyLogSummary,
        dailyFeatureSnapshot,
        totalEvents,
        createdAt
      });
      await this.unitOfWork.UserLogSummaryRepo.insert(newSummary);
      this.logger.log(`[SUMMARY] Created new rolling summary for userId=${userId}`);
      return;
    }

    // For existing summary, only update the fields, keep createdAt unchanged
    existingSummary.logSummary = logSummary;
    existingSummary.featureSnapshot = featureSnapshot;
    existingSummary.dailyLogSummary = dailyLogSummary;
    existingSummary.dailyFeatureSnapshot = dailyFeatureSnapshot;
    existingSummary.totalEvents = totalEvents;
    // updatedAt will be auto-updated by MikroORM
    await this.unitOfWork.UserLogSummaryRepo.getEntityManager().persistAndFlush(
      existingSummary
    );
    this.logger.log(`[SUMMARY] Updated existing rolling summary for userId=${userId}`);
  }

  /** Lay tat ca log */
  async getUserLogsWithPeriod(
    allUserLogRequest: AllUserLogRequest
  ): Promise<BaseResponse<EventLog[]>> {
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
          allUserLogRequest.startDate = getFirstDateOfPeriod(
            allUserLogRequest.period,
            convertToUTC(allUserLogRequest.endDate)
          );
        }

        const eventLogs = await this.unitOfWork.EventLogRepo.getEventLogs({
          startDate: convertToUTC(startOfDay(allUserLogRequest.startDate!)),
          endDate: convertToUTC(endOfDay(allUserLogRequest.endDate!))
        });

        return { success: true, data: eventLogs };
      },
      'Failed to get event logs with period',
      true
    );
  }

  /** Lay log tu userId */
  async getUserLogsByUserId(userId: string): Promise<BaseResponse<EventLog[]>> {
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
    const id = await this.unitOfWork.EventLogRepo.createSearchEvent(
      userId,
      searchText
    );
    await this.enqueueRollingSummaryUpdate(userId);
    return id;
  }

  async addProductViewLog(
    userId: string,
    productId: string,
    variantId?: string,
    productName?: string,
    variantName?: string,
    metadata?: Record<string, unknown>
  ): Promise<string> {
    const id = await this.unitOfWork.EventLogRepo.createProductViewEvent(
      userId,
      productId,
      variantId,
      productName,
      variantName,
      metadata
    );
    await this.enqueueRollingSummaryUpdate(userId);
    return id;
  }

  async addSearchTextLog(userId: string, searchText: string): Promise<string> {
    const id = await this.unitOfWork.EventLogRepo.createSearchEvent(
      userId,
      searchText
    );
    await this.enqueueRollingSummaryUpdate(userId);
    return id;
  }

  async addSurveyQuesAnsDetailToUserLog(
    userId: string,
    surveyQuesAnsId: string
  ): Promise<string[]> {
    const surveyQuesAnsDetail =
      await this.unitOfWork.AISurveyQuestionAnswerRepo.findOne({
        id: surveyQuesAnsId
      });

    const ids = await this.unitOfWork.EventLogRepo.createSurveyEventsFromDetails(
      userId,
      surveyQuesAnsDetail?.details.getItems() || []
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
    dailyLogSummary?: Record<string, string>,
    dailyFeatureSnapshot?: Record<string, unknown>
  ): Promise<BaseResponse<string>> {
    return await funcHandlerAsync(
      async () => {
        const existingSummary =
          await this.unitOfWork.UserLogSummaryRepo.findOne({ userId });
        if (!existingSummary) {
          const userLogSummary = new UserLogSummary({
            userId,
            logSummary: summary,
            totalEvents: 0,
            featureSnapshot: featureSnapshot || {},
            dailyLogSummary: dailyLogSummary || {},
            dailyFeatureSnapshot: dailyFeatureSnapshot || {}
          });

          await this.unitOfWork.UserLogSummaryRepo.insert(userLogSummary);
          return { success: true, data: userLogSummary.logSummary };
        }

        existingSummary.logSummary = summary;
        existingSummary.featureSnapshot =
          featureSnapshot || existingSummary.featureSnapshot;
        existingSummary.dailyLogSummary =
          dailyLogSummary || existingSummary.dailyLogSummary;
        existingSummary.dailyFeatureSnapshot =
          dailyFeatureSnapshot || existingSummary.dailyFeatureSnapshot;
        await this.unitOfWork.UserLogSummaryRepo.getEntityManager().persistAndFlush(
          existingSummary
        );
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
        const existingSummary =
          await this.unitOfWork.UserLogSummaryRepo.findOne({ userId });
        if (!existingSummary) {
          return { success: false, error: 'User log summary not found' };
        }
        existingSummary.logSummary = summary;
        await this.unitOfWork.UserLogSummaryRepo.getEntityManager().persistAndFlush(
          existingSummary
        );
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
          `Start Date: ${
            startDate ? startOfDay(convertToUTC(startDate)) : new Date(0)
          }, End Date: ${
            endDate ? endOfDay(convertToUTC(endDate)) : endOfDay(new Date())
          }`
        );

        const userLogSummary = await this.unitOfWork.UserLogSummaryRepo.findOne(
          {
            userId: userId
          }
        );
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
        const report = `User Log Summary Report from ${startDate ? convertToUTC(startDate) : 'the beginning'} to ${
          endDate ? convertToUTC(endDate) : new Date().toISOString()
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
          userLogRequest.startDate = getFirstDateOfPeriod(
            userLogRequest.period,
            convertToUTC(userLogRequest.endDate)
          );
        }

        // Lay log cua user trong khoang thoi gian
        const eventLogs = await this.unitOfWork.EventLogRepo.getEventLogs({
          userId: userLogRequest.userId,
          startDate: startOfDay(convertToUTC(userLogRequest.startDate!)),
          endDate: endOfDay(convertToUTC(userLogRequest.endDate))
        });

        if (!eventLogs.length) {
          return { success: false, error: 'User log not found' };
        }

        const { searchContents, messageContents, surveyContents, count } =
          buildContentSectionsFromEvents(eventLogs);

        console.log(`User ID: ${userLogRequest.userId}`);
        console.log(`Search Contents: ${searchContents}`);
        console.log(`Message Contents: ${messageContents}`);
        console.log(`Survey Contents: ${surveyContents}`);

        // Tao prompt de tong hop log
        const prompt = generateSummaryPrompt(
          searchContents,
          messageContents,
          surveyContents,
          startOfDay(convertToUTC(userLogRequest.startDate!)),
          endOfDay(convertToUTC(userLogRequest.endDate))
        );

        // Tao response tu cac log
        const response = convertUserLogsToReport(
          searchContents,
          messageContents,
          surveyContents,
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
    return await funcHandlerAsync(
      async () => {
        if (!allUserLogRequest.startDate) {
          allUserLogRequest.startDate = getFirstDateOfPeriod(
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
          const { searchContents, messageContents, surveyContents } =
            buildContentSectionsFromEvents(userEventLogs);

          console.log(`User ID: ${userId}`);
          console.log(`Search Contents: ${searchContents}`);
          console.log(`Message Contents: ${messageContents}`);
          console.log(`Survey Contents: ${surveyContents}`);

          // Tao prompt de tong hop log
          prompt +=
            generateSummaryPrompt(
              searchContents,
              messageContents,
              surveyContents,
              startOfDay(convertToUTC(allUserLogRequest.startDate!)),
              endOfDay(convertToUTC(allUserLogRequest.endDate))
            ) + '\n';

          response +=
            convertUserLogsToReport(
              searchContents,
              messageContents,
              surveyContents,
              startOfDay(convertToUTC(allUserLogRequest.startDate!)),
              endOfDay(convertToUTC(allUserLogRequest.endDate))
            ) + '\n';
        }

        return { success: true, data: { prompt, response } };
      },
      'Failed to summarize user logs',
      true
    );
  }

  // Tam thoi lay tat ca userId tu log
  async getAllUserIdsFromLogs(): Promise<string[]> {
    const userIds = await this.unitOfWork.EventLogRepo.getDistinctUserIds();
    return Array.from(new Set(userIds));
  }



  private resolveAllUserLogRange(request: AllUserLogRequest): {
    startDate: Date;
    endDate: Date;
  } {
    const endDate = convertToUTC(request.endDate || new Date());
    const startDate = request.startDate
      ? convertToUTC(request.startDate)
      : getFirstDateOfPeriod(request.period, endDate);

    return {
      startDate: startOfDay(startDate),
      endDate: endOfDay(endDate)
    };
  }

  private buildSummaryResponseFromEvents(
    userId: string,
    eventLogs: EventLog[]
  ): UserLogSummaryResponse {
    const featureSnapshot = normalizeFeatureSnapshot();
    const dailyFeatureSnapshot = normalizeDailyFeatureSnapshot();

    for (const event of eventLogs) {
      applyEventToFeatureSnapshot(featureSnapshot, event);
      applyEventToDailyFeatureSnapshot(dailyFeatureSnapshot, event);
    }

    const totalEvents = eventLogs.length;
    const dailyLogSummary = buildDailyLogSummaryMap(dailyFeatureSnapshot);
    const updatedAt =
      eventLogs.length > 0
        ? new Date(
            Math.max(...eventLogs.map((event) => event.createdAt.getTime()))
          )
        : new Date();

    return new UserLogSummaryResponse({
      userId,
      logSummary: buildRollingSummaryText(featureSnapshot, totalEvents),
      featureSnapshot,
      dailyLogSummary,
      dailyFeatureSnapshot,
      totalEvents,
      createdAt: updatedAt,
      updatedAt
    });
  }

  async getUserLogSummary(
    allUserLogRequest?: AllUserLogRequest
  ): Promise<
    BaseResponse<UserLogSummaryResponse>
  > {
    return funcHandlerAsync(
      async () => {
        const summaries = await this.getAllUserLogSummary(allUserLogRequest);
        if (!summaries.success || !summaries.data?.length) {
          return {
            success: false,
            error: 'User log summaries not found'
          };
        }

        const normalizedSnapshots = summaries.data.map((summary) =>
          normalizeFeatureSnapshot(summary.featureSnapshot)
        );
        const normalizedDailySnapshots = summaries.data.map((summary) =>
          normalizeDailyFeatureSnapshot(summary.dailyFeatureSnapshot)
        );
        const mergedSnapshot = mergeFeatureSnapshots(normalizedSnapshots);
        const mergedDailySnapshot = mergeDailyFeatureSnapshots(
          normalizedDailySnapshots
        );
        const totalEvents = summaries.data.reduce(
          (sum, summary) => sum + (summary.totalEvents || 0),
          0
        );

        const aggregatedText = buildRollingSummaryText(mergedSnapshot, totalEvents);
        const dailyLogSummary = buildDailyLogSummaryMap(mergedDailySnapshot);

        // Get earliest createdAt and latest updatedAt from all summaries
        const createdAt = new Date(
          Math.min(
            ...summaries.data.map((s) => s.createdAt?.getTime() || Date.now())
          )
        );
        const updatedAt = new Date(
          Math.max(
            ...summaries.data.map((s) => s.updatedAt?.getTime() || Date.now())
          )
        );

        return {
          success: true,
          data: new UserLogSummaryResponse({
            userId: 'all',
            totalEvents,
            createdAt,
            logSummary: aggregatedText,
            dailyLogSummary,
            featureSnapshot: mergedSnapshot,
            dailyFeatureSnapshot: mergedDailySnapshot,
            updatedAt
          })
        };
      },
      'Failed to aggregate user log summaries',
      true
    );
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
  async getUserLogs(
    userId: string,
    endDate?: Date,
    startDate?: Date
  ): Promise<BaseResponse<EventLog[]>> {
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
  async getUserLogSummaryByUserId(
    userId: string,
    period?: PeriodEnum,
    startDate?: Date,
    endDate?: Date
  ): Promise<BaseResponse<UserLogSummaryResponse | null>> {
    return funcHandlerAsync(
      async () => {
        if (startDate || endDate || period) {
          const normalizedEndDate = endDate
            ? endOfDay(convertToUTC(endDate))
            : endOfDay(convertToUTC(new Date()));
          const normalizedStartDate = startDate
            ? startOfDay(convertToUTC(startDate))
            : startOfDay(
                getFirstDateOfPeriod(
                  period ?? PeriodEnum.WEEKLY,
                  normalizedEndDate
                )
              );

          const eventLogs = await this.unitOfWork.EventLogRepo.getEventLogs({
            userId: userId.toLowerCase(),
            startDate: normalizedStartDate,
            endDate: normalizedEndDate
          });

          if (!eventLogs.length) {
            return {
              success: false,
              error: 'User log summary not found in selected period',
              data: null
            };
          }

          return {
            success: true,
            data: buildSummaryResponseFromEvents(userId, eventLogs)
          };
        }

        const userLogSummary = await this.unitOfWork.UserLogSummaryRepo.findOne(
          {
            userId: userId.toLowerCase()
          }
        );

        if (!userLogSummary) {
          return {
            success: false,
            error: 'User log summary not found',
            data: null
          };
        }
        return {
          success: true,
          data: UserLogSummaryMapper.toResponse(userLogSummary)
        };
      },
      'Failed to get user log summary',
      true
    );
  }

  async getAllUserLogSummary(
    allUserLogRequest?: AllUserLogRequest
  ): Promise<BaseResponse<UserLogSummaryResponse[] | null>> {
    return funcHandlerAsync(
      async () => {
        if (allUserLogRequest) {
          const { startDate, endDate } =
            resolveAllUserLogRange(allUserLogRequest);
          const eventLogs = await this.unitOfWork.EventLogRepo.getEventLogs({
            startDate,
            endDate
          });

          const groupedByUserId = new Map<string, EventLog[]>();
          for (const eventLog of eventLogs) {
            const key = eventLog.userId || 'anonymous';
            const current = groupedByUserId.get(key) || [];
            current.push(eventLog);
            groupedByUserId.set(key, current);
          }

          const summaryResponses = Array.from(groupedByUserId.entries())
            .map(([userId, logs]) =>
              buildSummaryResponseFromEvents(userId, logs)
            )
            .sort(
              (a, b) =>
                (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0)
            );

          return {
            success: true,
            data: summaryResponses
          };
        }

        const userLogSummaryEntities = await this.unitOfWork.UserLogSummaryRepo.find(
          {},
          { orderBy: { updatedAt: 'DESC' } }
        );

        if (!userLogSummaryEntities) {
          return {
            success: false,
            error: 'User log summary not found',
            data: null
          };
        }

        return {
          success: true,
          data: UserLogSummaryMapper.toResponseList(userLogSummaryEntities)
        };
      },
      'Failed to get user log summary',
      true
    );
  }

  async getAllUserLogSummaryReport(): Promise<BaseResponse<string | null>> {
    return funcHandlerAsync(
      async () => {
        const summaries = await this.getAllUserLogSummary();
        if (!summaries.success) {
          return {
            success: false,
            error: 'User log summary not found',
            data: null
          };
        }

        const report = summaries.data
          ?.map((summary) => summary.logSummary)
          .join('\n');
        return { success: true, data: report };
      },
      'Failed to get user log summary report',
      true
    );
  }

  /** Lay user summary theo tuan */
  async getUserLogSummaryByWeek(
    userId: string
  ): Promise<BaseResponse<UserLogSummaryResponse | null>> {
    const currentDate = new Date();
    const endDate = endOfWeek(convertToUTC(currentDate));
    const startDate = startOfWeek(convertToUTC(currentDate));
    return this.getUserLogSummaryByUserId(
      userId,
      PeriodEnum.WEEKLY,
      startDate,
      endDate
    );
  }

  /** Lay user summary theo thang */
  async getUserLogSummaryByMonth(
    userId: string
  ): Promise<BaseResponse<UserLogSummaryResponse | null>> {
    const currentDate = new Date();
    const endDate = endOfMonth(convertToUTC(currentDate));
    const startDate = startOfMonth(convertToUTC(currentDate));
    return this.getUserLogSummaryByUserId(
      userId,
      PeriodEnum.MONTHLY,
      startDate,
      endDate
    );
  }

  /** Lay user summary theo nam */
  async getUserLogSummaryByYear(
    userId: string
  ): Promise<BaseResponse<UserLogSummaryResponse | null>> {
    const currentDate = new Date();
    const endDate = endOfYear(convertToUTC(currentDate));
    const startDate = startOfYear(convertToUTC(currentDate));
    return this.getUserLogSummaryByUserId(
      userId,
      PeriodEnum.YEARLY,
      startDate,
      endDate
    );
  }

  async getAllSummaryByPeriod(
    period: PeriodEnum,
  ): Promise<BaseResponse<UserLogSummaryResponse[] | null>> {
    const normalizedEndDate = endOfDay(convertToUTC(new Date()));
    const normalizedStartDate = startOfDay(
      getFirstDateOfPeriod(period, normalizedEndDate)
    );
    return await this.getAllUserLogSummary({
      period,
      startDate: normalizedStartDate,
      endDate: normalizedEndDate
    });
  }
}
