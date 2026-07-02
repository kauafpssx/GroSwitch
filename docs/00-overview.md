# API Overview

Base URL:

- Dev: `http://localhost:8400` (frontend on `5173` proxies to it)
- Prod: same origin as the deployed backend

## Auth

Every route below except `GET /health` requires the header:

```
X-API-KEY: <MASTER_API_KEY>
```

`MASTER_API_KEY` is set in `.env`. It's a single shared secret; there's no per-user auth. A missing or wrong key returns:

```json
{ "success": false, "error": "Unauthorized: Invalid or missing API key" }
```
`401 Unauthorized`

## Response shape

Two conventions are used depending on the route group:

- **Management routes** (`/api/v1/*`) wrap responses in an envelope:
  ```json
  { "success": true, "data": { ... } }
  ```
  or on failure:
  ```json
  { "success": false, "error": "message" }
  ```
- **Proxy routes** (`/v1/*`) return the upstream Groq response body as-is (OpenAI-compatible shape), or on gateway-level failure:
  ```json
  { "error": { "message": "...", "code": 503, "status": "UNAVAILABLE" } }
  ```

## Routes

| Method | Route | Docs |
| --- | --- | --- |
| `POST` | `/v1/chat/completions` | [01-chat-completions.md](./01-chat-completions.md) |
| `POST` | `/v1/chat/completions/sync` | [02-chat-completions-sync.md](./02-chat-completions-sync.md) |
| `POST` | `/v1/audio/transcriptions` | [03-audio-transcriptions.md](./03-audio-transcriptions.md) |
| `POST` | `/v1/audio/speech` | [04-audio-speech.md](./04-audio-speech.md) |
| `GET` | `/api/v1/models` | [05-models-list.md](./05-models-list.md) |
| `GET` | `/api/v1/models/:model` | [06-models-get.md](./06-models-get.md) |
| `PUT` | `/api/v1/models/:model` | [07-models-update.md](./07-models-update.md) |
| `DELETE` | `/api/v1/models/:model` | [08-models-delete.md](./08-models-delete.md) |
| `PUT` | `/api/v1/config` | [09-config-update.md](./09-config-update.md) |
| `GET` | `/api/v1/keys` | [10-keys-list.md](./10-keys-list.md) |
| `GET` | `/api/v1/keys/:id` | [11-keys-get.md](./11-keys-get.md) |
| `POST` | `/api/v1/keys` | [12-keys-create.md](./12-keys-create.md) |
| `PUT` | `/api/v1/keys/:id` | [13-keys-update.md](./13-keys-update.md) |
| `GET` | `/api/v1/keys/:id/reveal` | [14-keys-reveal.md](./14-keys-reveal.md) |
| `POST` | `/api/v1/keys/reset-tokens` | [15-keys-reset-tokens.md](./15-keys-reset-tokens.md) |
| `DELETE` | `/api/v1/keys/:id` | [16-keys-delete.md](./16-keys-delete.md) |
| `GET` | `/api/v1/stats` | [17-stats.md](./17-stats.md) |
| `GET` | `/health` | [18-health.md](./18-health.md) |
| `GET` | `/status` | [19-status.md](./19-status.md) |

## Model types

Every model in `apps/backend/src/modules/models/model-rate-limits.csv` has a `type`, returned by `GET /api/v1/models`:

| Type | Meaning | Reaches Groq via |
| --- | --- | --- |
| `chat` | Plain text chat/completion | `/v1/chat/completions` |
| `vision` | Multimodal chat, accepts image input | `/v1/chat/completions` |
| `guard` | Moderation/classification model, chat-shaped in and out | `/v1/chat/completions` |
| `stt` | Speech-to-text (Whisper) | `/v1/audio/transcriptions` |
| `tts` | Text-to-speech (Orpheus) | `/v1/audio/speech` |

`vision` and `guard` reuse the chat completions endpoint: only the message content or model choice differs. `stt` and `tts` need their own routes because Groq's request/response format for those isn't JSON chat.

## Gateway behavior (applies to every `/v1/*` route)

Every proxy route runs the same key-selection/retry logic (`apps/backend/src/modules/proxy/attempt.ts`):

1. Look up the model's `rpm`/`rpd`/`tpm` (`GET /api/v1/models/:model`, seeded from the CSV, overridable per-model).
2. Pick a live API key (least-recently-used) that isn't over its daily or per-minute sliding-window limit.
3. Reserve a minute slot atomically, call Groq.
4. `429` → mark that key `dead` with a cooldown, try the next key.
5. `401`/`403` → mark that key `invalid` permanently, try the next key.
6. No live keys, or all attempts exhausted → `503`.
