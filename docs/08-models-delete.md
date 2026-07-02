# DELETE /api/v1/models/:model

Removes the DB override for a model, reverting it to its CSV default on next use.

Source: `apps/backend/src/modules/models/models.routes.ts`

## Headers

```
X-API-KEY: <MASTER_API_KEY>
```

## Path params

| Param | Notes |
| --- | --- |
| `model` | Model ID, URL-encoded |

## Example

```bash
curl -X DELETE http://localhost:8400/api/v1/models/llama-3.1-8b-instant \
  -H "X-API-KEY: your-master-api-key"
```

## Response

`200`:

```json
{ "success": true, "data": { "message": "Model deleted" } }
```

## Errors

| Status | Body | Cause |
| --- | --- | --- |
| `404` | `{"success":false,"error":"Model not found"}` | The model has no DB row (nothing to delete) |
