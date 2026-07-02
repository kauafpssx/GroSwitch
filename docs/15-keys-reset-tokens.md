# POST /api/v1/keys/reset-tokens

Resets `totalTokens` to `0` on every key.

Source: `apps/backend/src/modules/keys/keys.routes.ts`

## Headers

```
X-API-KEY: <MASTER_API_KEY>
```

## Body

None.

## Example

```bash
curl -X POST http://localhost:8400/api/v1/keys/reset-tokens \
  -H "X-API-KEY: your-master-api-key"
```

## Response

```json
{ "success": true, "data": { "message": "Tokens reset" } }
```
