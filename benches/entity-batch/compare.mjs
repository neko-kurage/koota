import { spawnSync, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const [baseline, candidate, directory, cases = 'all', pairsText = '3'] = process.argv.slice(2);
mkdirSync(directory, { recursive: true });
const power = () => execFileSync('pmset', ['-g', 'batt'], { encoding: 'utf8' });
const records = [];
const script = fileURLToPath(new URL('./measure.mjs', import.meta.url));
for (let pair = 0; pair < Number(pairsText); pair++) {
    for (const version of pair % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate']) {
        const before = power();
        if (!before.includes('AC Power')) throw new Error('AC power required');
        const bundle = resolve(version === 'baseline' ? baseline : candidate);
        const start = new Date().toISOString();
        const result = spawnSync(
            process.execPath,
            ['--expose-gc', script, bundle, version === 'baseline' ? 'ordinary' : 'batch', cases],
            { encoding: 'utf8', maxBuffer: 1024 * 1024 }
        );
        const after = power();
        writeFileSync(`${directory}/${pair + 1}-${version}.stderr`, result.stderr ?? '');
        if (result.status !== 0) throw new Error(result.stderr || `Exit ${result.status}`);
        if (!after.includes('AC Power')) throw new Error('Power changed');
        const record = {
            pair: pair + 1,
            version,
            start,
            end: new Date().toISOString(),
            cwd: process.cwd(),
            before,
            after,
            ...JSON.parse(result.stdout),
        };
        writeFileSync(`${directory}/${pair + 1}-${version}.json`, JSON.stringify(record, null, 2));
        records.push(record);
        console.log(
            JSON.stringify({
                pair: pair + 1,
                version,
                results: record.results.map(({ name, median, p95 }) => ({ name, median, p95 })),
            })
        );
    }
}
writeFileSync(`${directory}/summary.json`, JSON.stringify(records, null, 2));
