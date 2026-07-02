# PUT /api/v1/config

Set the default model used by [01-chat-completions.md](./01-chat-completions.md) and [02-chat-completions-sync.md](./02-chat-completions-sync.md) when no `model` is given in the request body. Persisted to `config.yml` at the repo root.

Source: `apps/backend/src/modules/models/models.routes.ts`, `apps/backend/src/modules/models/config.ts`

## Headers

```
Content-Type: application/json
X-API-KEY: <MASTER_API_KEY>
```

## Body

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `defaultModel` | string | Yes | Must be a known model (from [05-models-list.md](./05-models-list.md)) |

## Example

```bash
curl -X PUT http://localhost:8400/api/v1/config \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: your-master-api-key" \
  -d '{ "defaultModel": "llama-3.1-8b-instant" }'
```

## Response

`200`, the updated config object.

## Errors

| Status | Body | Cause |
| --- | --- | --- |
| `400` | `{"success":false,"error":"Missing required field: defaultModel"}` | No `defaultModel` in the body |
| `400` | `{"success":false,"error":"Unknown model"}` | `defaultModel` isn't in the model list |
