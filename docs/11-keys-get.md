# GET /api/v1/keys/:id

Get a single key (public shape).

Source: `apps/backend/src/modules/keys/keys.routes.ts`

## Headers

```
X-API-KEY: <MASTER_API_KEY>
```

## Path params

| Param | Notes |
| --- | --- |
| `id` | Key ID (from [10-keys-list.md](./10-keys-list.md)) |

## Example

```bash
curl http://localhost:8400/api/v1/keys/cmr2dgeu80000b4skrorgv644 \
  -H "X-API-KEY: your-master-api-key"
```

## Response

```json
{
  "success": true,
  "data": {
    "id": "cmr2dgeu80000b4skrorgv644",
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
}
```

## Errors

| Status | Body | Cause |
| --- | --- | --- |
| `404` | `{"success":false,"error":"Key not found"}` | No key with that `id` |
