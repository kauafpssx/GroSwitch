# GET /api/v1/models

List every model known from the CSV, plus any extra models that only exist in the DB.

Source: `apps/backend/src/modules/models/models.routes.ts`

## Headers

```
X-API-KEY: <MASTER_API_KEY>
```

## Body

None.

## Example

```bash
curl http://localhost:8400/api/v1/models \
  -H "X-API-KEY: your-master-api-key"
```

## Response

```json
{
  "success": true,
  "data": [
    { "id": "...", "model": "llama-3.1-8b-instant", "rpm": 30, "rpd": 14400, "tpm": 6000, "type": "chat" },
    { "id": "...", "model": "whisper-large-v3-turbo", "rpm": 20, "rpd": 2000, "tpm": 0, "type": "stt" }
  ]
}
```

`type` (`chat`/`vision`/`stt`/`tts`/`guard`) is static metadata parsed from `model-rate-limits.csv`, not stored in the DB and not editable through this API — see [00-overview.md](./00-overview.md#model-types).
