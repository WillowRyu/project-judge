import { spawnSync } from 'node:child_process';
import path from 'node:path';

// Exercise the real bundled imports with no credentials and no network access.
const root = path.resolve(import.meta.dirname, '..');
const result = spawnSync(process.execPath, [path.join(root, 'dist/index.js')], {
  cwd: root,
  env: { PATH: process.env.PATH },
  encoding: 'utf8',
  timeout: 10000,
});
const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
if (result.status !== 1 || !output.includes('GITHUB_TOKEN is required')) {
  console.error(output || result.error);
  throw new Error('The bundled Action did not reach its expected credential guard.');
}
console.log('Bundled Action loaded successfully and reported its missing credentials.');
