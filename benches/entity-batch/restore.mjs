import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('./', import.meta.url));
const repository = fileURLToPath(new URL('../../', import.meta.url));
const manifest = JSON.parse(readFileSync(new URL('./versions.json', import.meta.url), 'utf8'));
const [name, destinationText] = process.argv.slice(2);
const version = manifest.versions[name];
if (!version || !destinationText)
    throw new Error('Usage: node restore.mjs <version> <new-directory>');
const destination = resolve(destinationText);
if (existsSync(destination)) throw new Error('Destination must not exist.');
const run = (command, args, options = {}) => {
    const result = spawnSync(command, args, { encoding: 'utf8', ...options });
    if (result.status !== 0) throw new Error(result.stderr || `${command}: ${result.status}`);
    return result.stdout;
};
const archive = run('git', ['archive', manifest.base], {
    cwd: repository,
    encoding: null,
    maxBuffer: 32 * 1024 * 1024,
});
mkdirSync(destination, { recursive: true });
run('tar', ['-xf', '-', '-C', destination], { input: archive });
const chain = [];
for (let current = name; current !== 'baseline'; current = manifest.versions[current].parent)
    chain.unshift(current);
for (const current of chain)
    run('git', ['apply', resolve(directory, manifest.versions[current].patch)], { cwd: destination });
const files = { ...version.files };
if (process.argv.includes('--contracts')) {
    run('git', ['apply', resolve(directory, manifest.contracts.patch)], { cwd: destination });
    files[manifest.contracts.path] = manifest.contracts.sha256;
}
for (const [path, expected] of Object.entries(files)) {
    const actual = createHash('sha256')
        .update(readFileSync(resolve(destination, path)))
        .digest('hex');
    if (actual !== expected) throw new Error(`Source mismatch: ${path}`);
}
console.log(
    JSON.stringify({
        version: name,
        base: manifest.base,
        destination,
        patches: chain,
        verifiedFiles: Object.keys(files).length,
    })
);
