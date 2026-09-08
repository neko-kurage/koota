import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
const K = await import(pathToFileURL(process.argv[2]));
const sample = (values) => {
    values.sort((a, b) => a - b);
    return {
        p50: values[Math.floor(values.length * 0.5)],
        p99: values[Math.floor(values.length * 0.99)],
    };
};
const pause = () => new Promise((r) => setImmediate(r));
for (let round = 0; round < 3; round++) {
    const w = K.createWorld(),
        State = K.trait({ x: 0, v: 1 });
    const q = K.createQuery(State, K.IncludeDisabled());
    w.onQueryRemove(q, () => {});
    let entities = Array.from({ length: 500 }, () => w.spawn(State));
    for (const cycles of [0, 200, 800]) {
        const times = [];
        for (let i = 0; i < cycles; i++) {
            const start = performance.now();
            for (const e of entities.splice(0, 100)) e.destroy();
            for (let j = 0; j < 100; j++) entities.push(w.spawn(State));
            w.query(q);
            times.push(performance.now() - start);
        }
        await pause();
        global.gc();
        console.log(
            JSON.stringify({
                round,
                cycles,
                heap: process.memoryUsage().heapUsed,
                ...(times.length ? sample(times) : {}),
            })
        );
    }
    const times = [];
    for (let i = 0; i < 240; i++) {
        const start = performance.now();
        w.query(State).updateEach(([s]) => (s.x += s.v));
        if (i >= 40) times.push(performance.now() - start);
    }
    console.log(JSON.stringify({ round, key: 'update500', ...sample(times) }));
    w.destroy();
}
