# POST /v1/audio/speech

Text-to-speech. Forwards a request to Groq's Orpheus TTS endpoint. Request is JSON; response is a raw binary audio file, not JSON.

Source: `apps/backend/src/modules/proxy/audio.routes.ts`

## Headers

```
Content-Type: application/json
X-API-KEY: <MASTER_API_KEY>
```

## Body

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `input` | string | Yes | Text to speak |
| `model` | string | Yes | A `tts`-type model: `canopylabs/orpheus-v1-english` or `canopylabs/orpheus-arabic-saudi` |
| `voice` | string | Yes | Groq rejects the request with `400 "voice is required"` if omitted. Valid set depends on `model` — see table below |
| `response_format` | string | No | Gateway defaults to `wav` if omitted. Groq's own default (`mp3`) 400s on Orpheus models with `response_format must be one of [wav]` — the other formats in Groq's general docs (`flac`/`mulaw`/`ogg`) don't apply to Orpheus |
| `sample_rate` | integer | No | One of `8000`/`16000`/`22050`/`24000`/`32000`/`44100`/`48000`. Default `48000` |
| `speed` | number | No | `0.5`–`5`. Default `1` |

## Valid voices per model

| Model | Voices |
| --- | --- |
| `canopylabs/orpheus-arabic-saudi` | `abdullah`, `aisha`, `fahad`, `sultan`, `lulwa`, `noura` |
| `canopylabs/orpheus-v1-english` | `autumn`, `diana`, `hannah`, `austin`, `daniel`, `troy` |

## Example

```bash
curl -X POST http://localhost:8400/v1/audio/speech \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: your-master-api-key" \
  -d '{
    "model": "canopylabs/orpheus-v1-english",
    "input": "Hello, this is a test.",
    "voice": "autumn"
  }' \
  --output speech.wav
```

## Response

`200` with `Content-Type: audio/wav` (or whatever Groq reports) and the raw audio bytes as the body. Not wrapped in JSON.

## Errors

| Status | Body | Cause |
| --- | --- | --- |
| `400` | `{"error":{"message":"Missing required field: model","code":400,"status":"BAD_REQUEST"}}` | No `model` in the request body |
| `502` | `{"error":{"message":"voice is required","type":"invalid_request_error"}}` (or similar) | Groq rejected the request; most commonly a missing/invalid `voice` |
| `503` | `{"error":{"message":"No available API keys...","code":503,"status":"UNAVAILABLE"}}` | Same key-selection logic as chat; see [00-overview.md](./00-overview.md) |

> **Note:** Groq gates some TTS models behind org terms acceptance. If every attempt fails with `model_terms_required`, accept the model's terms at `console.groq.com/playground?model=<model-id>` (org admin) before retrying.
