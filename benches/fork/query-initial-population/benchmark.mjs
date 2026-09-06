import { performance } from 'node:perf_hooks';

const Koota = await import(process.argv[2]);
const count = 5000;
const samples = [];
for (let run = 0; run < 240; run++) {
    const world = Koota.createWorld();
    for (let i = 0; i < count; i++) world.spawn();
    const start = performance.now();
    const result = world.query();
    const elapsed = performance.now() - start;
    if (result.length !== count) throw new Error('Unexpected population');
    if (run >= 80) samples.push(elapsed);
    world.destroy();
}
samples.sort((a, b) => a - b);
console.log(JSON.stringify({ count, p50: samples[80], p99: samples[158] }));
