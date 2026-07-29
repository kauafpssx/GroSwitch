# GET /v1/models

OpenAI-compatible model listing. Same underlying data as [`GET /api/v1/models`](./05-models-list.md), reshaped to OpenAI's `list` envelope so OpenAI SDKs can call `client.models.list()` unmodified.

Source: `apps/backend/src/modules/proxy/proxy.routes.ts`

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

```json
{
  "object": "list",
  "data": [
    { "id": "llama-3.1-8b-instant", "object": "model", "created": 1732500000, "owned_by": "groq" },
    { "id": "whisper-large-v3-turbo", "object": "model", "created": 1732500000, "owned_by": "groq" }
  ]
}
```

`created` is the Unix timestamp the model's rate-limit row was first created in this gateway's DB, not Groq's actual model release date.
