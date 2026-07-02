# GET /api/v1/stats

Aggregate key-pool counts for the dashboard.

Source: `apps/backend/src/modules/keys/keys.routes.ts`

## Headers

```
X-API-KEY: <MASTER_API_KEY>
```

## Example

```bash
curl http://localhost:8400/api/v1/stats \
  -H "X-API-KEY: your-master-api-key"
```

## Response

```json
{
  "success": true,
  "data": {
    "total": 2,
    "live": 2,
    "dead": 0,
    "invalid": 0,
    "deadByReason": { "minute_limit": 0, "daily_limit": 0, "rate_limit": 0 },
    "dailyLimit": 14400,
    "minuteLimit": 30,
    "defaultModel": "llama-3.1-8b-instant"
  }
}
```

`dailyLimit`/`minuteLimit` reflect the current default model's rate limits (from [09-config-update.md](./09-config-update.md)).
