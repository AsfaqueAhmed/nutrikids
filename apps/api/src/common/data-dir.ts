import { existsSync } from 'fs';
import { dirname, resolve } from 'path';

/** Finds `<repo>/data/<sub>` by walking up from this file, so it works from src/ (tests) and dist/ (build). */
export function dataPath(sub: string): string {
  if (process.env.DATA_DIR) return resolve(process.env.DATA_DIR, sub);
  let dir = __dirname;
  for (;;) {
    const candidate = resolve(dir, 'data', sub);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`Cannot locate data/${sub}`);
    dir = parent;
  }
}
