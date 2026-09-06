import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [task, mode = 'baseline'] = process.argv.slice(2);
if (!['kernel-probe', 'codec-probe', 'codec-bench'].includes(task)) {
    throw new Error(
        'Usage: node run-neko.mjs kernel-probe|codec-probe|codec-bench [baseline|actual]'
    );
}
if (!process.env.NEKO_ROOT || !process.env.KOOTA_ENTRY) {
    throw new Error('Set NEKO_ROOT and KOOTA_ENTRY. NEKO_REV defaults to 19f99b8.');
}
const root = resolve(process.env.NEKO_ROOT);
const entry = resolve(process.env.KOOTA_ENTRY);
const revision = process.env.NEKO_REV ?? '19f99b8';
const directory = dirname(fileURLToPath(import.meta.url));
const temporary = mkdtempSync(join(tmpdir(), 'koota-candidate-repro-'));
try {
    // 保留中の作業差分が比較へ混ざらないよう、コミット済みsourceを展開する。
    const archive = execFileSync('git', ['-C', root, 'archive', revision, 'src'], {
        maxBuffer: 64 * 1024 * 1024,
    });
    execFileSync('tar', ['-x', '-C', temporary], { input: archive });
    const require = createRequire(join(root, 'package.json'));
    const esbuild = require('esbuild');
    const output = join(temporary, 'run.mjs');
    esbuild.buildSync({
        entryPoints: [join(directory, task + '.ts')],
        bundle: true,
        platform: 'node',
        format: 'esm',
        alias: { 'neko-source': join(temporary, 'src'), koota: entry },
        external: [entry],
        outfile: output,
    });
    execFileSync(process.execPath, [output, mode], { stdio: 'inherit' });
} finally {
    rmSync(temporary, { recursive: true, force: true });
}
