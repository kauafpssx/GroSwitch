// OpenAI's error envelope shape, so OpenAI-SDK clients parse errors the same
// way they would against api.openai.com.
export function openaiError(message: string, type: string, code: string | number | null = null) {
  return { error: { message, type, param: null, code } };
}

export function unavailable(message: string) {
  return openaiError(message, 'unavailable_error', 'service_unavailable');
}

export function badRequest(message: string) {
  return openaiError(message, 'invalid_request_error', 'bad_request');
}
