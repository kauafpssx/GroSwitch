# GET /v1/models

OpenAI-compatible model listing. Passes Groq's own `/openai/v1/models` catalog straight through (via a live key), so it reflects whatever Groq actually has active right now instead of the hand-maintained CSV behind [`GET /api/v1/models`](./05-models-list.md).

Source: `apps/backend/src/modules/proxy/proxy.routes.ts`, `apps/backend/src/modules/proxy/groq-client.ts` (`proxyListModels`)

## Headers

```
X-API-KEY: <MASTER_API_KEY>
```
or
```
Authorization: Bearer <MASTER_API_KEY>
```

## Body

None.

## Example

```bash
curl http://localhost:8400/v1/models \
  -H "Authorization: Bearer your-master-api-key"
```

## Response

Groq's response, unmodified:

```json
{
  "object": "list",
  "data": [
    { "id": "llama-3.1-8b-instant", "object": "model", "created": 1693721698, "owned_by": "Meta", "active": true, "context_window": 131072, "public_apps": null },
    { "id": "whisper-large-v3-turbo", "object": "model", "created": 1728413088, "owned_by": "OpenAI", "active": true, "context_window": 448, "public_apps": null }
  ]
}
```

## Errors

| Status | Body | Cause |
| --- | --- | --- |
| `503` | `{"error":{"message":"No available API keys.","type":"unavailable_error","param":null,"code":"service_unavailable"}}` | No live key passed the daily/minute filter, or every candidate key failed |

See also `GET /v1/models/:model` (same route file) for a single model, e.g. `GET /v1/models/llama-3.3-70b-versatile`.
