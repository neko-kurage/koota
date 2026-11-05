import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

const [bundle, mode = 'batch', selected = 'all'] = process.argv.slice(2);
const { createWorld, trait, relation, Not, spawnBatch } = await import(pathToFileURL(bundle));
const cases = [
    'empty',
    'two',
    'one',
    'ten-traits',
    'query',
    'not-query',
    'notify',
    'factory',
    'relation',
    'ordinary',
];
const results = [];
for (const name of cases.filter((name) => selected === 'all' || selected.split(',').includes(name))) {
    const world = createWorld();
    const traits = Array.from(
        { length: name === 'empty' ? 0 : name === 'ten-traits' ? 10 : 2 },
        (_, index) => trait({ x: index + 1, y: index + 2 })
    );
    const [position, velocity] = traits;
    const count = name === 'one' ? 1 : 10_000;
    const group = name === 'one' ? 1000 : 1;
    const config = [...traits];
    let notifications = 0;
    let factoryCalls = 0;
    const Added = trait();
    if (name === 'query') {
        world.query(position);
        world.query(position, velocity);
        world.query(velocity);
        world.query(position, Not(Added));
    }
    if (name === 'not-query') world.query(Not(Added));
    if (name === 'notify') {
        world.onQueryAdd([position, velocity], () => notifications++);
        world.onAdd(position, () => notifications++);
    }
    if (name === 'factory') config.push(trait({ value: () => ({ index: ++factoryCalls }) }));
    if (name === 'relation') {
        const target = world.spawn();
        const parent = relation({ exclusive: true });
        config.push(parent(target));
    }
    const spawn =
        mode === 'batch' && name !== 'ordinary'
            ? () => spawnBatch(world, count, ...config)
            : () => {
                  const entities = new Array(count);
                  for (let index = 0; index < count; index++)
                      entities[index] = world.spawn(...config);
                  return entities;
              };
    let operations = 0;
    let outputChecked = false;
    let lastDispose = 0;
    const iteration = () => {
        const groups = new Array(group);
        const start = performance.now();
        for (let index = 0; index < group; index++) groups[index] = spawn();
        const elapsed = performance.now() - start;
        const entities = groups[0];
        if (
            entities.length !== count ||
            (position && (entities[0].get(position).x !== 1 || !entities.at(-1).has(velocity)))
        )
            throw new Error('Output mismatch');
        if (!outputChecked) {
            for (const rows of groups)
                for (const entity of rows) {
                    for (let index = 0; index < traits.length; index++) {
                        const value = entity.get(traits[index]);
                        if (value.x !== index + 1 || value.y !== index + 2)
                            throw new Error('Initial value mismatch');
                    }
                }
            outputChecked = true;
        }
        operations += count * group;
        const disposeStart = performance.now();
        for (const rows of groups) for (const entity of rows) entity.destroy();
        // 遅延されたQueryの削除を、計時の外で確定する。
        if (name === 'query' || name === 'notify') world.query(position, velocity);
        if (name === 'not-query') world.query(Not(Added));
        lastDispose = (performance.now() - disposeStart) / group;
        return elapsed / group;
    };
    const cold = iteration();
    const warmStart = performance.now();
    while (performance.now() - warmStart < 350) iteration();
    const samples = [];
    const disposals = [];
    let measured = 0;
    while (measured < 650 || samples.length < 40) {
        const elapsed = iteration();
        samples.push(elapsed);
        disposals.push(lastDispose);
        measured += elapsed * group;
    }
    if (name === 'notify' && notifications !== operations * 2)
        throw new Error('Notification mismatch');
    if (name === 'factory' && factoryCalls !== operations) throw new Error('Factory mismatch');
    samples.sort((a, b) => a - b);
    disposals.sort((a, b) => a - b);
    global.gc?.();
    const before = process.memoryUsage().heapUsed;
    const retained = spawn();
    global.gc?.();
    const retainedBytes = process.memoryUsage().heapUsed - before;
    for (const entity of retained) entity.destroy();
    results.push({
        name,
        count,
        group,
        cold,
        median: samples[Math.floor(samples.length / 2)],
        p95: samples[Math.floor(samples.length * 0.95)],
        samples: samples.length,
        disposeMedian: disposals[Math.floor(disposals.length / 2)],
        retainedBytes,
    });
    world.destroy();
}
console.log(JSON.stringify({ node: process.version, pid: process.pid, bundle, mode, results }));
