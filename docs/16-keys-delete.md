# DELETE /api/v1/keys/:id

Removes a key from the pool permanently.

Source: `apps/backend/src/modules/keys/keys.routes.ts`

## Headers

```
X-API-KEY: <MASTER_API_KEY>
```

## Path params

| Param | Notes |
| --- | --- |
| `id` | Key ID |

## Example

```bash
curl -X DELETE http://localhost:8400/api/v1/keys/cmr2dgeu80000b4skrorgv644 \
  -H "X-API-KEY: your-master-api-key"
```

## Response

```json
{ "success": true, "data": { "message": "Key deleted" } }
```

## Errors

| Status | Body | Cause |
| --- | --- | --- |
| `404` | `{"success":false,"error":"Key not found"}` | No key with that `id` |
