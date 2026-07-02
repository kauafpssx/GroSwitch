import type { FastifyInstance } from 'fastify';
import { authPreHandler } from '@/plugins/auth';
import { keysRepository } from '@/modules/keys/keys.repository';
import { modelsRepository } from '@/modules/models/models.repository';
import { attemptGroqRequest } from './attempt';
import { proxyAudioSpeech, proxyAudioTranscription } from './groq-client';

function unavailable(message: string) {
  return { error: { message, code: 503, status: 'UNAVAILABLE' } };
}

export async function audioRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authPreHandler);

  // Speech-to-text (Whisper). multipart/form-data: either a `file` part or a
  // `url` field (Groq accepts either), a `model` field, and optionally
  // `language`/`prompt`/`response_format`/`temperature`/`timestamp_granularities[]`.
  app.post('/audio/transcriptions', async (request, reply) => {
    let fileBuffer: Buffer | undefined;
    let filename = 'audio';
    let mimetype = 'application/octet-stream';
    const fields: Record<string, string[]> = {};

    for await (const part of request.parts()) {
      if (part.type === 'file') {
        fileBuffer = await part.toBuffer();
        filename = part.filename;
        mimetype = part.mimetype;
      } else {
        (fields[part.fieldname] ??= []).push(String(part.value));
      }
    }

    const model = fields.model?.[0];
    if (!model) {
      return reply.status(400).send({ error: { message: 'Missing required field: model', code: 400, status: 'BAD_REQUEST' } });
    }
    if (!fileBuffer && !fields.url?.[0]) {
      return reply.status(400).send({ error: { message: 'Provide either a file or a url', code: 400, status: 'BAD_REQUEST' } });
    }

    const formData = new FormData();
    formData.append('model', model);
    if (fileBuffer) {
      formData.append('file', new Blob([new Uint8Array(fileBuffer)], { type: mimetype }), filename);
    }
    if (fields.url?.[0]) formData.append('url', fields.url[0]);
    if (fields.language?.[0]) formData.append('language', fields.language[0]);
    if (fields.prompt?.[0]) formData.append('prompt', fields.prompt[0]);
    if (fields.response_format?.[0]) formData.append('response_format', fields.response_format[0]);
    if (fields.temperature?.[0]) formData.append('temperature', fields.temperature[0]);
    for (const granularity of fields['timestamp_granularities[]'] ?? []) {
      formData.append('timestamp_granularities[]', granularity);
    }

    const rateLimit = await modelsRepository.findOrCreate(model);
    const liveKeys = await keysRepository.findLiveKeys(rateLimit.rpd, rateLimit.rpm);
    const outcome = await attemptGroqRequest(app.log, rateLimit, liveKeys, (key) =>
      proxyAudioTranscription(key, formData),
    );

    if (!outcome.ok) {
      const message =
        outcome.reason === 'no_keys'
          ? 'No available API keys. All keys are rate-limited or invalid.'
          : 'All keys exhausted.';
      return reply.status(503).send(unavailable(message));
    }

    const data = JSON.parse(outcome.result.body || '{}');
    return reply.send(data);
  });

  // Text-to-speech (Orpheus). JSON body: { model, input, voice, response_format? }.
  app.post('/audio/speech', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const model = body.model as string;
    if (!model) {
      return reply.status(400).send({ error: { message: 'Missing required field: model', code: 400, status: 'BAD_REQUEST' } });
    }
    // Groq's Orpheus models only support `wav`, unlike the fuller
    // flac/mp3/mulaw/ogg/wav set other TTS models accept — Groq's own
    // default (mp3) 400s on Orpheus if response_format isn't sent.
    const requestBody = { response_format: 'wav', ...body };

    const rateLimit = await modelsRepository.findOrCreate(model);
    const liveKeys = await keysRepository.findLiveKeys(rateLimit.rpd, rateLimit.rpm);
    const outcome = await attemptGroqRequest(app.log, rateLimit, liveKeys, (key) =>
      proxyAudioSpeech(key, model, requestBody),
    );

    if (!outcome.ok) {
      const message =
        outcome.reason === 'no_keys'
          ? 'No available API keys. All keys are rate-limited or invalid.'
          : 'All keys exhausted.';
      return reply.status(503).send(unavailable(message));
    }

    const { result } = outcome;
    if (!result.arrayBuffer) {
      const data = JSON.parse(result.body || '{}');
      return reply.status(502).send(data);
    }

    reply.header('Content-Type', result.contentType || 'audio/wav');
    return reply.send(Buffer.from(result.arrayBuffer));
  });
}
