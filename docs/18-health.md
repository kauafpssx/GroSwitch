# GET /health

Liveness check. No auth required.

Source: `apps/backend/src/server.ts`

## Headers

None required.

## Example

```bash
curl http://localhost:8400/health
```

## Response

```json
{ "status": "ok", "timestamp": "2026-07-02T13:01:20.519Z" }
```
