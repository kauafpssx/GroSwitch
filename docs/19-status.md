# GET /status

Raw key counts by status, pulled directly from the DB. Unlike [17-stats.md](./17-stats.md), this doesn't run the pre-emptive over-limit check first.

Source: `apps/backend/src/server.ts`

## Headers

```
X-API-KEY: <MASTER_API_KEY>
```

## Example

```bash
curl http://localhost:8400/status \
  -H "X-API-KEY: your-master-api-key"
```

## Response

```json
{ "total": 2, "live": 2, "dead": 0, "invalid": 0 }
```
