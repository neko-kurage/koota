import { performance } from 'node:perf_hooks';
const K = await import(process.argv[2]);
const Mark = K.trait({ value: 1 });
const Child = K.relation({ autoDestroy: 'source' });
const count = 5000;
for (const kind of ['empty', 'scalar', 'cascade']) {
    const world = K.createWorld();
    const times = [];
    for (let run = 0; run < 180; run++) {
        const entities = [];
        const root = kind === 'cascade' ? world.spawn(Mark) : undefined;
        for (let i = 0; i < count; i++)
            entities.push(
                kind === 'empty'
                    ? world.spawn()
                    : kind === 'scalar'
                      ? world.spawn(Mark)
                      : world.spawn(Mark, Child(root))
            );
        const start = performance.now();
        if (root !== undefined) root.destroy();
        else for (const entity of entities) entity.destroy();
        const elapsed = performance.now() - start;
        if (run >= 60) times.push(elapsed);
        if (world.entities.length !== 1) throw new Error('incomplete destruction');
    }
    times.sort((a, b) => a - b);
    console.log(JSON.stringify({ kind, count, p50: times[60], p99: times[118] }));
    world.destroy();
}
