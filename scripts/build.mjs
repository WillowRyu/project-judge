import { mkdtempSync, readdirSync, readFileSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
const output = mkdtempSync(path.join(tmpdir(), 'magi-build-'));
const destination = path.join(root, 'dist');
const check = process.argv.includes('--check');
function files(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const name = path.join(prefix, entry.name);
    return entry.isDirectory() ? files(path.join(directory, entry.name), name) : [name];
  }).sort();
}
try {
  const result = spawnSync(process.execPath, [require.resolve('@vercel/ncc/dist/ncc/cli.js'), 'build', 'src/index.ts', '-o', output, '--no-cache'], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`ncc exited with ${result.status}`);
  if (check) {
    const expected = files(output);
    const actual = files(destination);
    const matches = JSON.stringify(expected) === JSON.stringify(actual) && expected.every(name => readFileSync(path.join(output, name)).equals(readFileSync(path.join(destination, name))));
    if (!matches) throw new Error('dist is stale. Run pnpm build and include the generated files.');
    console.log('dist matches source and locked dependencies.');
  } else {
    rmSync(destination, { recursive: true, force: true });
    cpSync(output, destination, { recursive: true });
  }
} finally {
  rmSync(output, { recursive: true, force: true });
}
