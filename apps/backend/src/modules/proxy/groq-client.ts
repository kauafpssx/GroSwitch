import { env } from '@/lib/env';
import { keysRepository } from '@/modules/keys/keys.repository';
import type { ApiKey } from '@groswitch/common';

export interface GroqResponse {
  status: number;
  headers: Record<string, string>;
  stream: ReadableStream | null;
  body?: string;
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
