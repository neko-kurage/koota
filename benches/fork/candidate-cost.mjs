import { performance, PerformanceObserver } from 'node:perf_hooks';
import { Session } from 'node:inspector/promises';
import { pathToFileURL } from 'node:url';
const K = await import(pathToFileURL(process.argv[2]));
const count = Number(process.env.COUNT ?? 5000),
    samples = Number(process.env.SAMPLES ?? 100),
    batch = Number(process.env.BATCH ?? 10);
const mode = process.argv[3] ?? 'query';
const T = K.trait({ x: 0, y: 0, z: 0, vx: 1, vy: 2, vz: 3 }),
    w = K.createWorld();
const ents = Array.from({ length: count }, () => w.spawn(T));
const q = K.createQuery(T);
w.query(q);
// 基準だけをinline化せず、現行adapterと同じ関数呼出しの境界で比較する。
class DiagnosticAdapter {
    static readEntityTraits(world, entity) {
        return [...(world[K.$internal].entityTraits.get(entity) ?? [])];
    }
}
const readTraits = K.getEntityTraits ?? DiagnosticAdapter.readEntityTraits;
let checksum = 0;
const mutate = ([s]) => {
    s.x += s.vx;
    s.y += s.vy;
    s.z += s.vz;
};
const keep = (e) => e.id() % 2 === 0;
function run() {
    const r = w.query(q);
    if (mode === 'scalar') r.updateEach(mutate);
    else if (mode === 'diagnostics') {
        for (const e of r) checksum += readTraits(w, e).length;
    } else if (mode === 'filter') {
        if (K.retainQueryResult) K.retainQueryResult(r, keep);
        else {
            let size = 0;
            for (const e of r) if (keep(e)) r[size++] = e;
            r.length = size;
        }
    }
    checksum += r.length;
}
function prep() {
    if (mode === 'remove') {
        for (const e of ents) e.add(T);
        w.query(q);
        for (const e of ents) e.remove(T);
    }
}
for (let i = 0; i < 50; i++) {
    prep();
    run();
}
global.gc?.();
let gcMs = 0,
    gcCount = 0;
const obs = new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
        gcMs += e.duration;
        gcCount++;
    }
});
obs.observe({ entryTypes: ['gc'] });
const times = [];
for (let i = 0; i < samples; i++) {
    prep();
    const t = performance.now();
    for (let j = 0; j < (mode === 'remove' ? 1 : batch); j++) run();
    times.push((performance.now() - t) / (mode === 'remove' ? 1 : batch));
    await new Promise((r) => setImmediate(r));
}
await new Promise((r) => setImmediate(r));
obs.disconnect();
times.sort((a, b) => a - b);
const session = new Session();
session.connect();
await session.post('HeapProfiler.startSampling', {
    samplingInterval: 1024,
    includeObjectsCollectedByMajorGC: true,
    includeObjectsCollectedByMinorGC: true,
});
for (let i = 0; i < 100; i++) {
    prep();
    run();
}
const { profile } = await session.post('HeapProfiler.stopSampling');
session.disconnect();
console.log(
    JSON.stringify({
        mode,
        count,
        samples,
        batch,
        p50: times[Math.floor(samples * 0.5)],
        p99: times[Math.floor(samples * 0.99)],
        gcMs,
        gcCount,
        sampledBytes: profile.samples.reduce((sum, sample) => sum + sample.size, 0),
        checksum,
    })
);
w.destroy();
