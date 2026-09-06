import { mkdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const expectedNode = readFileSync(new URL('../.node-version', import.meta.url), 'utf8').trim();
if (process.versions.node !== expectedNode) {
    throw new Error(`Use Node ${expectedNode}; current Node is ${process.versions.node}`);
}

// Use upstream's pinned package manager and build transforms for the actual packed artifact.
const commands = [
    ['typecheck'],
    ['test', 'run'],
    ['test:build'],
    [
        '--filter',
        'koota',
        'pack',
        '--pack-destination',
        fileURLToPath(new URL('../.artifacts/', import.meta.url)),
    ],
];
mkdirSync(new URL('../.artifacts/', import.meta.url), { recursive: true });
for (const args of commands) {
    const result = spawnSync('corepack', ['pnpm', ...args], { cwd: root, stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
}
