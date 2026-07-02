# GET /api/v1/models/:model

Get a single model's rate limits, creating a DB row from the CSV default if this model has never been requested before.

Source: `apps/backend/src/modules/models/models.routes.ts`

## Headers

```
X-API-KEY: <MASTER_API_KEY>
```

## Path params

| Param | Notes |
| --- | --- |
| `model` | Model ID, URL-encoded (e.g. `meta-llama%2Fllama-4-scout-17b-16e-instruct` for `meta-llama/llama-4-scout-17b-16e-instruct`) |

## Example

```bash
curl http://localhost:8400/api/v1/models/llama-3.1-8b-instant \
  -H "X-API-KEY: your-master-api-key"
```

## Response

```json
{ "success": true, "data": { "id": "...", "model": "llama-3.1-8b-instant", "rpm": 30, "rpd": 14400, "tpm": 6000, "type": "chat" } }
```
