# PUT /api/v1/models/:model

Override RPM/RPD/TPM for a model. Values persist in the `ModelRateLimit` table and win over the CSV default from then on.

Source: `apps/backend/src/modules/models/models.routes.ts`

## Headers

```
Content-Type: application/json
X-API-KEY: <MASTER_API_KEY>
```

## Path params

| Param | Notes |
| --- | --- |
| `model` | Model ID, URL-encoded |

## Body

Provide at least one field.

| Field | Type | Required |
| --- | --- | --- |
| `rpm` | number | No |
| `rpd` | number | No |
| `tpm` | number | No |

## Example

```bash
curl -X PUT http://localhost:8400/api/v1/models/llama-3.1-8b-instant \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: your-master-api-key" \
  -d '{ "rpm": 60, "rpd": 5000, "tpm": 20000 }'
```

## Response

`200`, the updated model object:

```json
{ "success": true, "data": { "id": "...", "model": "llama-3.1-8b-instant", "rpm": 60, "rpd": 5000, "tpm": 20000, "type": "chat" } }
```

## Errors

| Status | Body | Cause |
| --- | --- | --- |
| `400` | `{"success":false,"error":"Provide at least one: rpm, rpd, tpm"}` | Body had none of `rpm`/`rpd`/`tpm` |

`type` is not editable through this route — it's fixed CSV metadata.
