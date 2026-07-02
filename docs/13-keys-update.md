# PUT /api/v1/keys/:id

Rename a key and/or swap its credential. Swapping the credential resets `status` to `live` and clears cooldown/dead state.

Source: `apps/backend/src/modules/keys/keys.routes.ts`

## Headers

```
Content-Type: application/json
X-API-KEY: <MASTER_API_KEY>
```

## Path params

| Param | Notes |
| --- | --- |
| `id` | Key ID |

## Body

Provide at least one field.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | string | No | Non-empty if provided |
| `key` | string | No | New raw Groq API key, ≥10 characters |

## Example

```bash
curl -X PUT http://localhost:8400/api/v1/keys/cmr2dgeu80000b4skrorgv644 \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: your-master-api-key" \
  -d '{ "name": "renamed" }'
```

## Response

`200`, updated key (public shape).

## Errors

| Status | Body | Cause |
| --- | --- | --- |
| `400` | `{"success":false,"error":"Provide at least one: name, key"}` | Neither field given |
| `400` | `{"success":false,"error":"Invalid name"}` | `name` empty/whitespace |
| `400` | `{"success":false,"error":"Invalid API key format"}` | `key` shorter than 10 characters |
| `404` | `{"success":false,"error":"Key not found"}` | No key with that `id` |
