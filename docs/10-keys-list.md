# GET /api/v1/keys

List all Groq API keys in the pool (public shape; credentials never included).

Source: `apps/backend/src/modules/keys/keys.routes.ts`

## Headers

```
X-API-KEY: <MASTER_API_KEY>
```

## Example

```bash
curl http://localhost:8400/api/v1/keys \
  -H "X-API-KEY: your-master-api-key"
```

## Response

```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "name": "ff3",
      "status": "live",
      "lastUsedAt": "2026-07-02T13:05:15.895Z",
      "limitedUntil": null,
      "cooldownRemainingMs": null,
      "deadReason": "",
      "dailyCount": 1,
      "minuteCount": 1,
      "totalTokens": 39,
      "createdAt": "2026-07-01T17:51:06.272Z"
    }
  ]
}
```

`status` is one of `live` / `dead` / `invalid`. `deadReason` is one of `""` / `minute_limit` / `daily_limit` / `rate_limit` / `invalid_key`.
