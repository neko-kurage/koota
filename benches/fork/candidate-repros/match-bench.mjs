import { K } from './load-koota.mjs';
import { performance } from 'node:perf_hooks';
const [mode, shape, churn] = process.argv.slice(2);
const w = K.createWorld();
const T = K.trait();
const entities = Array.from({ length: 5000 }, () => w.spawn(T));
const q = K.createQuery(T);
let revision = 0;
let syncs = 0;
if (mode === 'shared') {
    w.onQueryAdd(q, () => revision++);
    w.onQueryRemove(q, () => revision++);
}
const attachments = (shape === 'count' ? [entities] : entities.map((e) => [e])).map((source) => ({
    source,
    matches: new Map(),
    revision: -1,
}));
let sink = 0;
function tick(i) {
    if (churn === '1pct')
        for (let n = 0; n < 50; n++) {
            const e = entities[(i * 50 + n) % 5000];
            if (e.has(T)) e.remove(T);
            else e.add(T);
        }
    for (const a of attachments) {
        if (mode === 'baseline' || a.revision !== revision) {
            a.revision = revision;
            syncs++;
            const current = new Set(a.source);
            for (const [e] of a.matches)
                if (!current.has(e) || !e.isAlive() || !e.has(T) || e.has(K.IsExcluded))
                    a.matches.delete(e);
            for (const e of a.source)
                if (!a.matches.has(e) && e.isAlive() && e.has(T) && !e.has(K.IsExcluded))
                    a.matches.set(e, true);
        }
        for (const e of a.source)
            if (a.matches.has(e) && e.isAlive() && e.has(T) && !e.has(K.IsExcluded)) sink++;
    }
}
for (let i = 0; i < 50; i++) tick(i);
syncs = 0;
const times = [];
for (let i = 0; i < 180; i++) {
    const s = performance.now();
    tick(i);
    times.push(performance.now() - s);
}
times.sort((a, b) => a - b);
console.log(JSON.stringify({ mode, shape, churn, p50: times[90], p99: times[178], syncs, sink }));
w.destroy();
