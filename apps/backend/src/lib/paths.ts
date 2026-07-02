import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Walk up from the current file to find the monorepo root (the directory that
// contains the root package.json with the "workspaces" field).
// Works both from source (apps/backend/src/lib/) and bundled output
// (apps/backend/dist/), where import.meta.dir / fileURLToPath differ.
function findRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 20; i++) {
    const pkgPath = resolve(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const content = readFileSync(pkgPath, 'utf-8');
        if (content.includes('"workspaces"')) {
          return dir;
        }
      } catch {
        // Permission error or similar – keep walking up
      }
    }
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('Could not find project root (package.json with workspaces)');
}

export const ROOT_DIR = findRoot(__dirname);
