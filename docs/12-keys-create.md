# POST /api/v1/keys

Add a Groq API key to the pool. Encrypted at rest (AES-256-GCM).

Source: `apps/backend/src/modules/keys/keys.routes.ts`

## Headers

```
Content-Type: application/json
X-API-KEY: <MASTER_API_KEY>
```

## Body

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | string | Yes | Non-empty label for the key |
| `key` | string | Yes | The raw Groq API key, ≥10 characters |

## Example

```bash
curl -X POST http://localhost:8400/api/v1/keys \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: your-master-api-key" \
  -d '{ "name": "my-key", "key": "gsk_..." }'
```

## Response

`201`, the created key (public shape, same fields as [11-keys-get.md](./11-keys-get.md)).

## Errors

| Status | Body | Cause |
| --- | --- | --- |
| `400` | `{"success":false,"error":"Missing required fields: name, key"}` | `name` or `key` absent |
| `400` | `{"success":false,"error":"Invalid name"}` | `name` empty/whitespace |
| `400` | `{"success":false,"error":"Invalid API key format"}` | `key` shorter than 10 characters |
| `400` | `{"success":false,"error":"Maximum key limit reached (100)"}` | Pool already has 100 keys |
