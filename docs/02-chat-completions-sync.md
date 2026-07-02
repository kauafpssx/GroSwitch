# POST /v1/chat/completions/sync

Non-streaming chat completion. Same body as [01-chat-completions.md](./01-chat-completions.md) (text, vision, guard all apply), but always returns a single JSON response — `stream` in the body is ignored/overridden. Use this from server-to-server callers or anywhere reading an SSE stream is inconvenient; the frontend's Vision and Guard pages use this route.

Source: `apps/backend/src/modules/proxy/proxy.routes.ts`

## Headers

```
Content-Type: application/json
X-API-KEY: <MASTER_API_KEY>
```

## Body

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `model` | string | No | Defaults to the configured default model (see [09-config-update.md](./09-config-update.md)) |
| `messages` | array | Yes | OpenAI chat format |
| ...rest | — | No | Any other Groq-supported chat-completions field is passed through untouched |

## Example

```bash
curl -X POST http://localhost:8400/v1/chat/completions/sync \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: your-master-api-key" \
  -d '{
    "model": "llama-3.1-8b-instant",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## Response

```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "model": "llama-3.1-8b-instant",
  "choices": [{ "index": 0, "message": { "role": "assistant", "content": "..." }, "finish_reason": "stop" }],
  "usage": { "prompt_tokens": 37, "completion_tokens": 2, "total_tokens": 39 },
  "x_groq": { "id": "req_...", "usage": { "queue_time": 0.15, "prompt_time": 0.002, "completion_time": 0.004, "total_time": 0.006 } }
}
```

## Errors

| Status | Body | Cause |
| --- | --- | --- |
| `503` | `{"error":{"message":"No available API keys.","code":503,"status":"UNAVAILABLE"}}` | No live key passed the daily/minute filter |
| `503` | `{"error":{"message":"All keys exhausted.","code":503,"status":"UNAVAILABLE"}}` | Every candidate key returned non-200 |

See [00-overview.md](./00-overview.md) for the key-selection/retry logic shared by every `/v1/*` route.
