import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const mode = process.argv[2];
if (!['live', 'snapshot'].includes(mode) || !process.env.KOOTA_ENTRY) {
    throw new Error('Set KOOTA_ENTRY; run node destroy-hook-probe.mjs live|snapshot.');
}
const entry = resolve(process.env.KOOTA_ENTRY);
const temporary = mkdtempSync(join(tmpdir(), 'koota-destroy-hook-'));
try {
    // 計測用hookは破棄可能な複製だけに追加し、指定された配布物は変更しない。
    cpSync(dirname(entry), temporary, { recursive: true });
    writeFileSync(join(temporary, 'package.json'), '{"type":"module"}');
    const anchor = '  }\n}\n\n// ../core/src/world/world.ts';
    let changed = 0;
    for (const file of readdirSync(temporary).filter((name) => name.endsWith('.js'))) {
        const path = join(temporary, file);
        const source = readFileSync(path, 'utf8');
        if (!source.includes('const processedEntities = cachedSet;') || !source.includes(anchor))
            continue;
        assert.equal(source.split(anchor).length, 2, 'Expected one v0.6.6 destroy-loop anchor');
        const iterable = mode === 'snapshot' ? '[...processedEntities]' : 'processedEntities';
        writeFileSync(
            path,
            source.replace(
                anchor,
                `  }\n  if (ctx.reviewDestroy) { for (const dead of ${iterable}) ctx.reviewDestroy(dead); }\n}\n\n// ../core/src/world/world.ts`
            )
        );
        changed++;
    }
    assert.equal(
        changed,
        1,
        'This instrumentation requires the v0.6.6 bundle shape; inspect changes before adapting.'
    );
    const K = await import(pathToFileURL(join(temporary, basename(entry))).href);
    const w = K.createWorld();
    const Rel = K.relation({ autoDestroy: 'source' });
    const parent = w.spawn();
    const child = w.spawn(Rel(parent));
    const other = w.spawn();
    const seen = [];
    w[K.$internal].reviewDestroy = (e) => {
        seen.push(e === parent ? 'parent' : e === child ? 'child' : 'other');
        assert.equal(e.isAlive(), false);
        if (e === parent) other.destroy();
    };
    parent.destroy();
    console.log(mode, JSON.stringify({ seen, childAlive: child.isAlive() }));
    assert.equal(child.isAlive(), false);
    assert.equal(seen.includes('child'), mode === 'snapshot');
    w.destroy();
} finally {
    rmSync(temporary, { recursive: true, force: true });
}
