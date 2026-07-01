import { resolve } from 'path';

// apps/backend/src/lib -> apps/backend/src -> apps/backend -> apps -> repo root
export const ROOT_DIR = resolve(import.meta.dir, '../../../..');
