import { env } from '@/lib/env';
import { keysRepository } from '@/modules/keys/keys.repository';
import type { ApiKey } from '@groswitch/common';

export interface GroqResponse {
  status: number;
  headers: Record<string, string>;
  stream: ReadableStream | null;
  body?: string;
  // Populated instead of `body` for binary responses (e.g. /audio/speech),
  // which aren't valid UTF-8 text and can't be read via response.text().
  arrayBuffer?: ArrayBuffer;
  contentType?: string;
}

export async function proxyToGroq(
  apiKey: ApiKey,
  model: string,
  body: Record<string, unknown>,
  stream: boolean,
): Promise<GroqResponse> {
  const decryptedKey = keysRepository.getDecryptedKey(apiKey.key);
  const requestBody = { ...body, model, stream };

  const response = await fetch(`${env.GROQ_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${decryptedKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  // Only successful streaming responses hand back the raw stream; every
  // other case (including a successful non-streaming call) needs the body
  // read as text here.
  const usesRawStream = response.status === 200 && stream;

  let bodyText: string | undefined;
  if (!usesRawStream) {
    try {
      bodyText = await response.text();
    } catch {
      bodyText = '{"error":{"message":"Failed to read upstream response"}}';
    }
  }

  return {
    status: response.status,
    headers: responseHeaders,
    stream: usesRawStream ? (response.body as ReadableStream) : null,
    body: bodyText,
  };
}

// Forwards a multipart/form-data transcription request to Groq's Whisper
// endpoint. `formData` already contains the audio file + `model` (+ any
// optional fields like `language`/`prompt`/`response_format`) — no
// Content-Type header is set manually so fetch generates the multipart
// boundary itself.
export async function proxyAudioTranscription(apiKey: ApiKey, formData: FormData): Promise<GroqResponse> {
  const decryptedKey = keysRepository.getDecryptedKey(apiKey.key);

  const response = await fetch(`${env.GROQ_BASE_URL}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${decryptedKey}`,
    },
    body: formData,
  });

  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  let bodyText: string | undefined;
  try {
    bodyText = await response.text();
  } catch {
    bodyText = '{"error":{"message":"Failed to read upstream response"}}';
  }

  return {
    status: response.status,
    headers: responseHeaders,
    stream: null,
    body: bodyText,
  };
}

// Forwards a text-to-speech request to Groq's /audio/speech endpoint. On
// success the response body is binary audio, not JSON, so it's read via
// arrayBuffer() instead of text() and carried on `arrayBuffer`/`contentType`.
export async function proxyAudioSpeech(
  apiKey: ApiKey,
  model: string,
  body: Record<string, unknown>,
): Promise<GroqResponse> {
  const decryptedKey = keysRepository.getDecryptedKey(apiKey.key);
  const requestBody = { ...body, model };

  const response = await fetch(`${env.GROQ_BASE_URL}/audio/speech`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${decryptedKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  if (response.status !== 200) {
    let bodyText: string | undefined;
    try {
      bodyText = await response.text();
    } catch {
      bodyText = '{"error":{"message":"Failed to read upstream response"}}';
    }
    return { status: response.status, headers: responseHeaders, stream: null, body: bodyText };
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    status: response.status,
    headers: responseHeaders,
    stream: null,
    arrayBuffer,
    contentType: response.headers.get('content-type') || 'audio/wav',
  };
}
