# POST /v1/audio/transcriptions

Speech-to-text. Forwards an audio file to Groq's Whisper transcription endpoint. `multipart/form-data`, not JSON.

Source: `apps/backend/src/modules/proxy/audio.routes.ts`

## Headers

```
X-API-KEY: <MASTER_API_KEY>
```

Do **not** set `Content-Type` manually. Let the HTTP client generate the multipart boundary.

## Form fields

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `file` | file | One of `file`/`url` | Audio file (`flac`/`mp3`/`mp4`/`mpeg`/`mpga`/`m4a`/`ogg`/`wav`/`webm`). Groq accepts up to 25MB; this gateway enforces the same cap via `@fastify/multipart` |
| `url` | string | One of `file`/`url` | Audio URL instead of an uploaded file (supports Base64URL) |
| `model` | string | Yes | An `stt`-type model: `whisper-large-v3` or `whisper-large-v3-turbo` |
| `language` | string | No | ISO 639-1 code, improves accuracy and latency if known |
| `prompt` | string | No | Optional context to bias transcription style, or continue a previous audio segment |
| `response_format` | string | No | `json` (default), `text`, or `verbose_json` |
| `temperature` | number | No | `0`–`1`, default `0`. Higher = more random output |
| `timestamp_granularities[]` | string, repeatable | No | `word` and/or `segment`. Requires `response_format=verbose_json`; word timestamps add latency |

## Example

```bash
curl -X POST http://localhost:8400/v1/audio/transcriptions \
  -H "X-API-KEY: your-master-api-key" \
  -F "file=@recording.wav" \
  -F "model=whisper-large-v3-turbo"
```

## Response

Groq's JSON body, returned as-is:

```json
{
  "text": "The quick brown fox jumps over the lazy dog.",
  "x_groq": { "id": "req_..." }
}
```

## Errors

| Status | Body | Cause |
| --- | --- | --- |
| `400` | `{"error":{"message":"Missing required field: model","code":400,"status":"BAD_REQUEST"}}` | No `model` field |
| `400` | `{"error":{"message":"Provide either a file or a url","code":400,"status":"BAD_REQUEST"}}` | Neither a `file` part nor a `url` field was given |
| `503` | `{"error":{"message":"No available API keys...","code":503,"status":"UNAVAILABLE"}}` | Same key-selection logic as chat; see [00-overview.md](./00-overview.md) |

Rate limits (`rpm`/`rpd`) apply per model same as chat; `tpm` is `0` for Whisper models since Groq bills transcription by audio duration, not tokens.
