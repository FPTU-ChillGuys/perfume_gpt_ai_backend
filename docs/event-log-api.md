# Event Log API (Phase 2)

## Overview
This document describes the new unified event log endpoint introduced for the log redesign.

## Migration Notice

Legacy log tables are now intentionally removed (test data accepted to be lost):
- `user_log`
- `user_message_log`
- `user_search_log`
- `user_quiz_log`

Migration file:
- `src/migrations/Migration20260315120000.ts`

After pulling this branch, run migration up before starting the app:

```bash
pnpm migration:up
```

Current status:
- New endpoint added: `GET /logs/events`
- New paged endpoint added: `GET /logs/events/paged`
- `GET /logs/all` and `GET /logs/all/period` now return unified `event_log` records
- Search/message/quiz writes now dual-write into `event_log`
- Summary generation now reads from `event_log`

## Event Model

Each event row has the following shape:

```json
{
  "id": "uuid",
  "createdAt": "2026-03-15T10:00:00.000Z",
  "updatedAt": "2026-03-15T10:00:00.000Z",
  "isActive": true,
  "userId": "user-id-or-null",
  "eventType": "message | search | quiz",
  "entityType": "conversation | search | quiz",
  "entityId": "uuid-or-null",
  "contentText": "string-or-null",
  "metadata": {}
}
```

Hybrid payload rule:
- `search`, `message`: primary content in `contentText`
- `quiz`: structured details in `metadata`

## Endpoint

### GET /logs/events

Query params (all optional):
- `userId`: string
- `eventType`: `message | search | quiz`
- `startDate`: ISO date-time
- `endDate`: ISO date-time

### Example request

```http
GET /logs/events?userId=0e95f&eventType=search&startDate=2026-03-01T00:00:00.000Z&endDate=2026-03-15T23:59:59.999Z
```

### Example response

```json
{
  "success": true,
  "data": [
    {
      "id": "a1b2c3d4-e5f6-4b08-92f8-16365f0a7a1c",
      "createdAt": "2026-03-15T09:10:22.001Z",
      "updatedAt": "2026-03-15T09:10:22.001Z",
      "isActive": true,
      "userId": "f3a6cb8a-1111-2222-3333-f639f67b30f1",
      "eventType": "search",
      "entityType": "search",
      "entityId": null,
      "contentText": "summer perfume",
      "metadata": {
        "source": "user_search"
      }
    }
  ]
}
```

### GET /logs/events/paged

Query params:
- `PageNumber`: number (default `1`)
- `PageSize`: number (default `10`)
- `IsDescending`: boolean (default `false`)
- `userId`: string (optional)
- `eventType`: `message | search | quiz` (optional)
- `startDate`: ISO date-time (optional)
- `endDate`: ISO date-time (optional)

### Example request

```http
GET /logs/events/paged?PageNumber=1&PageSize=20&IsDescending=true&eventType=message
```

### Example response

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "a1b2c3d4-e5f6-4b08-92f8-16365f0a7a1c",
        "createdAt": "2026-03-15T09:10:22.001Z",
        "updatedAt": "2026-03-15T09:10:22.001Z",
        "isActive": true,
        "userId": "f3a6cb8a-1111-2222-3333-f639f67b30f1",
        "eventType": "message",
        "entityType": "conversation",
        "entityId": "8e6bd313-2c72-4b0b-92e1-c6cc36ec4f56",
        "contentText": "Mình thích mùi tươi mát",
        "metadata": {
          "sender": "user"
        }
      }
    ],
    "pageNumber": 1,
    "pageSize": 20,
    "totalCount": 125,
    "totalPages": 7,
    "hasPreviousPage": false,
    "hasNextPage": true
  }
}
```

### POST /logs/events

Use this endpoint when frontend/admin needs to push custom events directly.

### Request body

```json
{
  "userId": "f3a6cb8a-1111-2222-3333-f639f67b30f1",
  "eventType": "search",
  "entityType": "search",
  "contentText": "woody perfume",
  "metadata": {
    "source": "frontend_manual"
  }
}
```

### Response

```json
{
  "success": true,
  "data": { "id": "uuid" }
}
```

### GET /logs/events/summary

Quick aggregate counts for dashboard cards.

Query params (all optional):
- `userId`
- `startDate`
- `endDate`

### Example response

```json
{
  "success": true,
  "data": {
    "userId": "f3a6cb8a-1111-2222-3333-f639f67b30f1",
    "startDate": "2026-03-01T00:00:00.000Z",
    "endDate": "2026-03-15T23:59:59.999Z",
    "totalCount": 42,
    "messageCount": 18,
    "searchCount": 20,
    "quizCount": 4
  }
}
```

### GET /logs/events/summary/timeseries

Use this endpoint for chart visualization (line/bar) by day or week.

Query params (all optional):
- `userId`
- `startDate`
- `endDate`
- `granularity`: `day | week` (default `day`)

### Example request

```http
GET /logs/events/summary/timeseries?userId=f3a6cb8a-1111-2222-3333-f639f67b30f1&startDate=2026-03-01T00:00:00.000Z&endDate=2026-03-15T23:59:59.999Z&granularity=day
```

### Example response

```json
{
  "success": true,
  "data": {
    "userId": "f3a6cb8a-1111-2222-3333-f639f67b30f1",
    "startDate": "2026-03-01T00:00:00.000Z",
    "endDate": "2026-03-15T23:59:59.999Z",
    "granularity": "day",
    "points": [
      {
        "bucketStart": "2026-03-01T00:00:00.000Z",
        "totalCount": 5,
        "messageCount": 2,
        "searchCount": 2,
        "quizCount": 1
      },
      {
        "bucketStart": "2026-03-02T00:00:00.000Z",
        "totalCount": 8,
        "messageCount": 4,
        "searchCount": 3,
        "quizCount": 1
      }
    ]
  }
}
```

## Frontend Mapping Notes

Legacy -> New:
- `userMessageLogs[].message.message` -> `eventType=message`, `contentText`
- `userSearchLogs[].content` -> `eventType=search`, `contentText`
- `userQuizLogs[]` -> `eventType=quiz`, `metadata`

For timeline UI:
- Call `GET /logs/events`
- Group/sort by `createdAt`
- Render by `eventType`

## Notes for Existing Summary Endpoints

These endpoints keep the same route but their data source is now unified events:
- `GET /logs/report/activity/user`
- `GET /logs/report/activity/all`

Frontend behavior does not need to change for these routes, but returned summaries now reflect `event_log` content.

## Direct-Switch Endpoints

These existing routes have been switched to event-based output:
- `GET /logs/all`
- `GET /logs/all/period`

If frontend previously consumed nested objects (`userMessageLogs`, `userSearchLogs`, `userQuizLogs`), migrate to the flat event model.

## Next Planned API Changes

- Add create endpoint for manual event ingestion (optional admin flow)
- Add explicit summary DTOs with event counts for frontend dashboards
