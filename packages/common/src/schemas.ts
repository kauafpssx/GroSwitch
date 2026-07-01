import { z } from 'zod';

export const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  key: z.string().min(10, 'Invalid Gemini API key'),
});

export const ApiKeyParamsSchema = z.object({
  id: z.string().cuid(),
});

export const ProxyBodySchema = z.object({
  model: z.string().min(1),
  contents: z.array(z.unknown()),
  generationConfig: z.record(z.unknown()).optional(),
}).passthrough();

export const AuthHeaderSchema = z.object({
  'x-api-key': z.string().optional(),
});

export const AuthQuerySchema = z.object({
  api_key: z.string().optional(),
});

export type CreateApiKeyInput = z.infer<typeof CreateApiKeySchema>;
export type ProxyBody = z.infer<typeof ProxyBodySchema>;
