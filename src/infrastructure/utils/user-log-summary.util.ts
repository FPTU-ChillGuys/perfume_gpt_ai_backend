import { endOfDay, format, startOfDay } from 'date-fns';
import { EventLog } from 'src/domain/entities/event-log.entity';
import { EventLogEventType } from 'src/domain/enum/event-log-event-type.enum';
import { tokenizeText } from './nlp-tokenizer';

export type RollingFeatureSnapshot = {
  eventTypeCounts: Record<string, number>;
  keywordCounts: Record<string, number>;
  intentCounts: Record<string, number>;
  audienceCounts: Record<string, number>;
  hourCounts: Record<string, number>;
};

export type DailyFeatureSnapshot = Record<string, RollingFeatureSnapshot>;

export function createEmptyRollingFeatureSnapshot(): RollingFeatureSnapshot {
  return {
    eventTypeCounts: {},
    keywordCounts: {},
    intentCounts: {},
    audienceCounts: {},
    hourCounts: {}
  };
}

export function normalizeFeatureSnapshot(
  snapshot?: Record<string, unknown>
): RollingFeatureSnapshot {
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

export function normalizeDailyFeatureSnapshot(
  snapshot?: Record<string, unknown>
): DailyFeatureSnapshot {
  if (!snapshot || typeof snapshot !== 'object') {
    return {};
  }

  const normalized: DailyFeatureSnapshot = {};
  for (const [dateKey, rawSnapshot] of Object.entries(snapshot)) {
    if (!rawSnapshot || typeof rawSnapshot !== 'object') {
      continue;
    }

    normalized[dateKey] = normalizeFeatureSnapshot(
      rawSnapshot as Record<string, unknown>
    );
  }

  return normalized;
}

export function increaseCounter(
  counters: Record<string, number>,
  key: string,
  amount = 1
): void {
  if (!key) {
    return;
  }
  counters[key] = (counters[key] || 0) + amount;
}

export function extractTextFromMetadata(
  metadata?: Record<string, unknown>
): string[] {
  if (!metadata) {
    return [];
  }

  const pieces: string[] = [];
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  const visit = (value: unknown, depth: number): void => {
    if (depth > 3 || value === null || value === undefined) {
      return;
    }

    if (typeof value === 'string') {
      const text = value.trim();
      if (text && !uuidPattern.test(text)) {
        pieces.push(text);
      }
      return;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      pieces.push(String(value));
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item, depth + 1);
      }
      return;
    }

    if (typeof value === 'object') {
      for (const nested of Object.values(value as Record<string, unknown>)) {
        visit(nested, depth + 1);
      }
    }
  };

  visit(metadata, 0);
  return pieces;
}

export function getEventDateKey(date: Date): string {
  return format(date, 'M/d/yyyy');
}

export function applyEventToFeatureSnapshot(
  featureSnapshot: RollingFeatureSnapshot,
  event: EventLog
): void {
  increaseCounter(featureSnapshot.eventTypeCounts, event.eventType);
  increaseCounter(featureSnapshot.hourCounts, String(event.createdAt.getHours()));

  const textParts: string[] = [];
  if (event.contentText) {
    textParts.push(event.contentText);
  }

  textParts.push(...extractTextFromMetadata(event.metadata));

  const normalizedText = textParts.join(' ').toLowerCase();
  const keywords = tokenizeText(normalizedText);
  for (const keyword of keywords) {
    increaseCounter(featureSnapshot.keywordCounts, keyword);
  }

  if (/recommend|goi y|gợi ý|suggest/.test(normalizedText)) {
    increaseCounter(featureSnapshot.intentCounts, 'recommendation');
  }
  if (/buy|mua|order|don hang|đơn hàng/.test(normalizedText)) {
    increaseCounter(featureSnapshot.intentCounts, 'purchase');
  }
  if (/gift|qua tang|quà tặng/.test(normalizedText)) {
    increaseCounter(featureSnapshot.intentCounts, 'gift');
  }
  if (event.eventType === EventLogEventType.QUIZ) {
    increaseCounter(featureSnapshot.intentCounts, 'quiz_engagement');
  }
  if (event.eventType === EventLogEventType.PRODUCT) {
    increaseCounter(featureSnapshot.intentCounts, 'product_interest');
  }

  if (/men|male|nam/.test(normalizedText)) {
    increaseCounter(featureSnapshot.audienceCounts, 'male');
  }
  if (/women|female|nu|nữ/.test(normalizedText)) {
    increaseCounter(featureSnapshot.audienceCounts, 'female');
  }
  if (/unisex/.test(normalizedText)) {
    increaseCounter(featureSnapshot.audienceCounts, 'unisex');
  }
}

export function applyEventToDailyFeatureSnapshot(
  dailyFeatureSnapshot: DailyFeatureSnapshot,
  event: EventLog
): void {
  const dateKey = getEventDateKey(event.createdAt);
  const snapshot = dailyFeatureSnapshot[dateKey] || createEmptyRollingFeatureSnapshot();
  applyEventToFeatureSnapshot(snapshot, event);
  dailyFeatureSnapshot[dateKey] = snapshot;
}

export function getTotalEventsFromFeatureSnapshot(
  featureSnapshot: RollingFeatureSnapshot
): number {
  return Object.values(featureSnapshot.eventTypeCounts).reduce(
    (sum, value) => sum + value,
    0
  );
}

export function buildDailyLogSummaryMap(
  dailyFeatureSnapshot: DailyFeatureSnapshot
): Record<string, string> {
  const sortedEntries = Object.entries(dailyFeatureSnapshot).sort(
    (a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime()
  );

  return Object.fromEntries(
    sortedEntries.map(([dateKey, snapshot]) => [
      dateKey,
      buildRollingSummaryText(snapshot, getTotalEventsFromFeatureSnapshot(snapshot))
    ])
  );
}

export function buildRollingSummaryText(
  featureSnapshot: RollingFeatureSnapshot,
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

export function buildContentSectionsFromEvents(eventLogs: EventLog[]): {
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
      .map(
        (log) =>
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

export function mergeFeatureSnapshots(
  snapshots: RollingFeatureSnapshot[]
): RollingFeatureSnapshot {
  const merged = createEmptyRollingFeatureSnapshot();

  for (const snapshot of snapshots) {
    for (const [key, value] of Object.entries(snapshot.eventTypeCounts)) {
      increaseCounter(merged.eventTypeCounts, key, value);
    }
    for (const [key, value] of Object.entries(snapshot.keywordCounts)) {
      increaseCounter(merged.keywordCounts, key, value);
    }
    for (const [key, value] of Object.entries(snapshot.intentCounts)) {
      increaseCounter(merged.intentCounts, key, value);
    }
    for (const [key, value] of Object.entries(snapshot.audienceCounts)) {
      increaseCounter(merged.audienceCounts, key, value);
    }
    for (const [key, value] of Object.entries(snapshot.hourCounts)) {
      increaseCounter(merged.hourCounts, key, value);
    }
  }

  return merged;
}

export function mergeDailyFeatureSnapshots(
  snapshots: DailyFeatureSnapshot[]
): DailyFeatureSnapshot {
  const merged: DailyFeatureSnapshot = {};

  for (const snapshot of snapshots) {
    for (const [dateKey, dailySnapshot] of Object.entries(snapshot)) {
      merged[dateKey] = mergeFeatureSnapshots([
        merged[dateKey] || createEmptyRollingFeatureSnapshot(),
        dailySnapshot
      ]);
    }
  }

  return merged;
}

export function convertUserLogsToReport(
  searchContents: string,
  messageContents: string,
  quizContents: string,
  startDate: Date,
  endDate: Date
): string {
  return `User activity summary from ${startOfDay(new Date(startDate))} to ${endOfDay(new Date(endDate))}:\n\nSearch Activities: ${searchContents}\n\nMessages: ${messageContents}\n\nQuiz Answers: ${quizContents}\n`;
}
