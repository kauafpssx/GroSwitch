# GET /api/v1/keys/:id/reveal

Decrypts and returns a key's raw credential, for copying into another tool.

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
curl http://localhost:8400/api/v1/keys/cmr2dgeu80000b4skrorgv644/reveal \
  -H "X-API-KEY: your-master-api-key"
```

## Response

```json
{ "success": true, "data": { "key": "gsk_..." } }
```

## Errors

| Status | Body | Cause |
| --- | --- | --- |
| `404` | `{"success":false,"error":"Key not found"}` | No key with that `id` |

This returns a decrypted secret in plaintext. Restrict who has the `MASTER_API_KEY`.
