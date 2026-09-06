import { performance } from 'node:perf_hooks';

// 比較する配布物を別processへ読み込み、Query更新だけを測定する。
const Koota = await import(process.argv[2]);
const world = Koota.createWorld();
const Value = Koota.trait({ x: 0, y: 1 });
for (let i = 0; i < 5000; i++) world.spawn(Value);

const query = Koota.createQuery(Value);
const update = ([value]) => { value.x += value.y; };
for (let i = 0; i < 500; i++) world.query(query).updateEach(update, { changeDetection: 'never' });

const times = [];
for (let i = 0; i < 1200; i++) {
  const before = performance.now();
  world.query(query).updateEach(update, { changeDetection: 'never' });
  times.push(performance.now() - before);
}

times.sort((a, b) => a - b);
console.log(JSON.stringify({ p50: times[600], p99: times[1188] }));
world.destroy();
