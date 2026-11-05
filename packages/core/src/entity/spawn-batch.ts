import { $internal } from '../common';
import { createEntity, destroyEntity } from './entity';
import { allocateEntity, isEntityAlive } from './utils/entity-index';
import { getEntityId } from './utils/pack-entity';
import { addBatchTraits, registerTrait, notifyBatchTrait, hasTrait } from '../trait/trait';
import { IsInactive } from '../query/query';
import { disabledEntities, ownerInactiveSlots, markCreatedOwnerInactive } from './entity-activation';
import { getTraitInstance, hasTraitInstance } from '../trait/trait-instance';
import { isRelationPair } from '../relation/utils/is-relation';
import { isOrderedTrait } from '../relation/ordered';
import { notifyQuery } from '../query/activation-notifications';
import type { BatchTraitWrite } from '../trait/trait';
import type { ConfigurableTrait, Trait, TraitInstance } from '../trait/types';
import type { QueryInstance } from '../query/types';
import type { Entity } from './types';
import type { World } from '../world';

export interface SpawnBatchOptions {
    /** 全個体へ加えるTrait列。 */
    readonly traits?: readonly ConfigurableTrait[];
    /** 個体ごとのTrait列。生成区間の外で用意した値として読む。traitsより優先する。 */
    readonly traitsByEntity?: readonly (readonly ConfigurableTrait[])[];
    /** 所有者の実効状態。falseならQuery通知より先にIsInactiveを付け、所有者の再開まで通常Queryから除外する。既定はtrue。 */
    readonly ownerActive?: boolean;
    /** 個体自身の初期要求状態。falseならQuery参加前にIsInactiveを設定する。既定はtrue。 */
    readonly enabled?: boolean;
    /**
     * 生成したEntityの所有を、個体を観測し得る通知より先に接続する。Worldは変更しない。
     * 構成を一度に保存できる生成では、全個体の保存後に生成順で呼ぶ。Trait・Queryの追加購読へは、
     * 全個体のinitializeの後に生成順で通知する。Relationなど個体ごとに保存する生成では、
     * 個体ごとにTrait追加の前に呼ぶ。
     */
    readonly initialize?: (entity: Entity, index: number) => void;
    /** initializeと個体の通知を終えた後に呼ぶ。Worldは変更しない。 */
    readonly complete?: (entity: Entity, index: number) => void;
}

const noTraits: readonly ConfigurableTrait[] = [];

// FORK(Entity/batch-spawn): 同じ構成の保存先・mask・Query一致を生成区間で一度だけ解決する。
// Relation・AoS・追跡Queryなど個体ごとの保存や照合が要る構成だけ、個体ごとに生成する。
export function spawnBatch(world: World, count: number, options: SpawnBatchOptions): Entity[] {
    if (!Number.isSafeInteger(count) || count < 0 || count > 0xffffffff)
        throw new RangeError('Entity count must be a non-negative array length.');
    const entities = new Array<Entity>(count);
    if (count === 0) return entities;
    if (options.traitsByEntity !== undefined && options.traitsByEntity.length < count)
        throw new RangeError('traitsByEntity must have an entry for each Entity.');
    const ctx = world[$internal];

    const initiallyInactive = options.ownerActive === false || options.enabled === false;
    if (initiallyInactive && !hasTraitInstance(ctx.traitInstances, IsInactive))
        registerTrait(world, IsInactive);
    const inactive = initiallyInactive ? getTraitInstance(ctx.traitInstances, IsInactive) : undefined;

    const plan = SpawnPlan.prepare(world, count, options, inactive);
    if (plan === undefined) spawnEach(world, count, options, inactive, entities);
    else plan.spawn(entities, options);
    return entities;
}

/** 一つの構成で生成する個体の、Traitごとの保存とQueryへの参加。 */
class SpawnPlan {
    /** IsInactiveを先頭に置いた、追加順のTrait instance。 */
    private readonly instances: TraitInstance[] = [];
    /** 構成のmaskを持つ世代と、その世代のbit。 */
    private readonly generations: number[] = [];
    private readonly bits: number[] = [];
    private readonly order: Trait[] = [];
    /** 値を持つTraitのinstance・setter・宣言内の位置。共有値がなければ個体の値を既定値へ重ねる。 */
    private readonly stores: TraitInstance[] = [];
    private readonly setters: Trait[typeof $internal]['set'][] = [];
    private readonly positions: number[] = [];
    private readonly shared: (Record<string, unknown> | undefined)[] = [];
    private readonly keys: string[][] = [];
    private readonly defaults: Record<string, unknown>[] = [];
    /** 構成のTraitに関係するQueryと、そのうち構成のmaskに一致するQuery。 */
    private readonly candidates: QueryInstance[] = [];
    private readonly matched: QueryInstance[] = [];
    /** 新規個体のslotで、過去の個体の追跡状態を消すQuery。 */
    private readonly trackingResets: QueryInstance[] = [];
    private readonly dirtyMasks: number[][][] = [];

    private constructor(
        private readonly world: World,
        private readonly count: number,
        private readonly traitsByEntity: readonly (readonly ConfigurableTrait[])[] | undefined,
        private readonly inactive: TraitInstance | undefined
    ) {}

    /** 全個体が先頭と同じ構成で、個体ごとの照合が要る観測者がいなければ準備する。 */
    public static prepare(
        world: World,
        count: number,
        options: SpawnBatchOptions,
        inactive: TraitInstance | undefined
    ): SpawnPlan | undefined {
        const traitsByEntity = options.traitsByEntity;
        const first = traitsByEntity === undefined ? (options.traits ?? noTraits) : traitsByEntity[0];
        const plan = new SpawnPlan(world, count, traitsByEntity, inactive);
        if (!plan.resolve(first) || !plan.sameComposition(first) || plan.observed()) return;
        return plan;
    }

    public spawn(entities: Entity[], options: SpawnBatchOptions): void {
        const world = this.world;
        const ctx = world[$internal];
        const entityIndex = ctx.entityIndex;
        const count = this.count;
        const slots = new Array<number>(count);
        for (let index = 0; index < count; index++) {
            const entity = allocateEntity(entityIndex);
            entities[index] = entity;
            slots[index] = getEntityId(entity);
        }

        // 生成中は利用側のcallbackを呼ばないため、個体ごとではなく保存先ごとにまとめて書く。
        const { generations, bits } = this;
        for (let generation = 0; generation < generations.length; generation++) {
            const bit = bits[generation];
            const masks = [ctx.entityMasks[generations[generation]]];
            for (const dirtyMask of this.dirtyMasks) masks.push(dirtyMask[generations[generation]]);
            for (const mask of masks) {
                for (let index = 0; index < count; index++) mask[slots[index]] |= bit;
            }
        }
        for (const query of this.trackingResets) {
            for (let index = 0; index < count; index++) query.resetTrackingBitmasks(slots[index]);
        }
        ctx.entityTraits.createAll(entities, slots, this.order);
        if (options.ownerActive === false) {
            const ownerInactive = ownerInactiveSlots(world);
            for (let index = 0; index < count; index++) ownerInactive[slots[index]] = entities[index];
        }
        if (options.enabled === false) {
            const disabled = disabledEntities(world);
            for (let index = 0; index < count; index++) disabled.add(entities[index]);
        }

        const traitsByEntity = this.traitsByEntity;
        for (let store = 0; store < this.stores.length; store++) {
            const set = this.setters[store];
            const columns = this.stores[store].store;
            const shared = this.shared[store];
            if (shared !== undefined) {
                // SoAのsetterは指定indexの列だけを書く。先頭へ保存した列の値を後続へ複製する。
                const first = slots[0];
                set(first, columns, shared);
                for (const key of this.keys[store]) {
                    const column = (columns as Record<string, unknown[]>)[key];
                    const value = column[first];
                    for (let index = 1; index < count; index++) column[slots[index]] = value;
                }
                continue;
            }
            // 値付き宣言は既定値へ重ね、Traitの通常の追加と同じsetterで保存する。
            const defaults = this.defaults[store];
            const position = this.positions[store];
            for (let index = 0; index < count; index++) {
                const params = (traitsByEntity![index][position] as [Trait, object])[1];
                set(slots[index], columns, { ...defaults, ...params });
            }
        }

        // 構成のQuery一致は全個体で同じなので、準備時に一度だけ求めてある。
        for (const query of this.matched) {
            // 世代が一巡した完全IDだけが、Queryの削除待ちに残り得る。
            if (query.toRemove.length !== 0) {
                for (let index = 0; index < count; index++) query.toRemove.remove(entities[index]);
            }
            query.entities.addAll(entities);
            query.version += count;
        }

        // 所有を全個体へ接続してから、購読へ通知する。保存中は利用側のcallbackを呼ばない。
        const { initialize, complete } = options;
        let index = 0;
        try {
            if (initialize !== undefined) {
                for (; index < count; index++) initialize(entities[index], index);
            }
        } catch (error) {
            // 所有を接続できなかった個体と後続の個体は残さない。
            for (let rest = count - 1; rest >= index; rest--) {
                if (isEntityAlive(entityIndex, entities[rest])) destroyEntity(world, entities[rest]);
            }
            throw error;
        }

        this.notify(entities);
        if (complete !== undefined) {
            for (index = 0; index < count; index++) complete(entities[index], index);
        }
    }

    /** 生成順に、一致したQueryの追加購読、構成のTraitの追加購読の順で通知する。 */
    private notify(entities: readonly Entity[]): void {
        const queries = this.matched.filter((query) => query.addSubscriptions.size !== 0);
        const instances = this.instances.filter((instance) => instance.addSubscriptions.size !== 0);
        if (queries.length === 0 && instances.length === 0) return;
        const world = this.world;
        // 先の通知で終了した個体には、後続の通知を届けない。
        // world.hasはinline展開しない。同じ関数で同じ関数を二度展開すると、展開器が変数名を取り違える。
        for (let index = 0; index < entities.length; index++) {
            const entity = entities[index];
            for (const query of queries) {
                for (const subscription of query.addSubscriptions) {
                    if (!world.has(entity)) break;
                    // 初期化や先の通知でQueryから外れた個体へ、古い追加を通知しない。
                    const isStillSelected = query.entities.has(entity) && !query.toRemove.has(entity);
                    if (!isStillSelected) break;
                    notifyQuery(world, subscription, entity);
                }
            }
            for (const instance of instances) {
                for (const subscription of instance.addSubscriptions) {
                    if (!world.has(entity)) break;
                    subscription(entity);
                }
            }
        }
    }

    /** 先頭個体のTrait列から保存・順序・候補Queryを解決する。個体ごとの準備が要る宣言ならfalse。 */
    private resolve(configs: readonly ConfigurableTrait[]): boolean {
        const world = this.world;
        const ctx = world[$internal];
        const instances = this.instances;
        if (this.inactive !== undefined) instances.push(this.inactive);

        for (let position = 0; position < configs.length; position++) {
            const config = configs[position];
            if (isRelationPair(config)) return false;
            const trait = (Array.isArray(config) ? config[0] : config) as Trait;
            if (isOrderedTrait(trait) || trait[$internal].type === 'aos') return false;
            if (!hasTraitInstance(ctx.traitInstances, trait)) registerTrait(world, trait);
            const instance = getTraitInstance(ctx.traitInstances, trait)!;
            if (instances.includes(instance)) return false;
            instances.push(instance);

            const schema = instance.schema as Record<string, unknown>;
            if (Object.keys(schema).length === 0) continue;
            // 個体ごとに作る既定値は共有できない。
            if (!Object.isFrozen(schema) || !isScalarRecord(schema)) return false;
            this.stores.push(instance);
            this.setters.push(trait[$internal].set);
            this.positions.push(position);
            this.shared.push(Array.isArray(config) ? undefined : schema);
            this.keys.push(Object.keys(schema));
            this.defaults.push(schema);
        }

        for (const instance of instances) {
            this.order.push(instance.trait);
            const generation = this.generations.indexOf(instance.generationId);
            if (generation === -1) {
                this.generations.push(instance.generationId);
                this.bits.push(instance.bitflag);
            } else this.bits[generation] |= instance.bitflag;
            for (const query of instance.queries) {
                if (!this.candidates.includes(query)) this.candidates.push(query);
            }
        }
        for (const query of ctx.notQueries) {
            if (!this.candidates.includes(query)) this.candidates.push(query);
        }
        for (const dirtyMask of ctx.dirtyMasks.values()) {
            for (const generation of this.generations) dirtyMask[generation] ??= [];
            this.dirtyMasks.push(dirtyMask);
        }
        for (const query of this.candidates) {
            if (this.matches(query)) this.matched.push(query);
            else if (query.isTracking && ctx.notQueries.has(query)) this.trackingResets.push(query);
        }
        return true;
    }

    /** 構成のmaskだけを持つ新規個体が、通常のQuery照合で一致するか。 */
    private matches(query: QueryInstance): boolean {
        if (query.traitInstances.all.length === 0) return false;
        for (let index = 0; index < query.generations.length; index++) {
            const bitmask = query.staticBitmasks[index];
            if (!bitmask) continue;
            const { required, forbidden, or } = bitmask;
            const generation = this.generations.indexOf(query.generations[index]);
            const mask = generation === -1 ? 0 : this.bits[generation];
            if (!forbidden && !required && !or) return false;
            if (forbidden && (mask & forbidden) !== 0) return false;
            if (required && (mask & required) !== required) return false;
            if (or !== 0 && (mask & or) === 0) return false;
        }
        return true;
    }

    /** 全個体のTrait列が、先頭と同じTraitを同じ順で持つか。値付き宣言の値だけは個体ごとに異なってよい。 */
    private sameComposition(first: readonly ConfigurableTrait[]): boolean {
        const traitsByEntity = this.traitsByEntity;
        if (traitsByEntity === undefined) return true;
        let previous = first;
        for (let index = 1; index < this.count; index++) {
            const configs = traitsByEntity[index];
            if (configs === previous) continue;
            if (configs.length !== first.length) return false;
            for (let position = 0; position < configs.length; position++) {
                const config = configs[position];
                const expected = first[position];
                if (config === expected) continue;
                if (!Array.isArray(config) || !Array.isArray(expected) || config[0] !== expected[0])
                    return false;
            }
            previous = configs;
        }
        return true;
    }

    /**
     * 新規個体ごとの照合が必要な観測者がいるか。追加購読は全個体の保存後に通知するため含めない。
     * 構成に一致しないQueryは、追跡・Relationがあっても新規個体を観測しない。
     */
    private observed(): boolean {
        for (const instance of this.instances) {
            if (instance.trackingQueries.size !== 0) return true;
        }
        for (const query of this.matched) {
            if (
                query.isTracking ||
                (query.relationFilters !== undefined && query.relationFilters.length !== 0)
            )
                return true;
        }
        return false;
    }
}

function isScalarRecord(record: Record<string, unknown>): boolean {
    if (Object.getPrototypeOf(record) !== Object.prototype) return false;
    for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(record))) {
        if (!('value' in descriptor)) return false;
        const type = typeof descriptor.value;
        if (type !== 'number' && type !== 'string' && type !== 'boolean') return false;
    }
    return true;
}

/** 観測者がいる生成。個体ごとに所有を接続し、Trait通知を既存の順序で発行する。 */
function spawnEach(
    world: World,
    count: number,
    options: SpawnBatchOptions,
    initialInactive: TraitInstance | undefined,
    entities: Entity[]
): void {
    // Trait.idごとの保存準備を、このspawnBatchの期間だけ共有する。
    const writesByTraitId: (BatchTraitWrite | null | undefined)[] = [];
    const ctx = world[$internal];
    let inactive = initialInactive;

    for (let index = 0; index < count; index++) {
        // resetでIsInactiveのTraitInstanceが入れ替わったら、次の個体には新しいinstanceを使う。
        if (inactive && inactive !== ctx.traitInstances[IsInactive.id]) {
            inactive = getTraitInstance(ctx.traitInstances, IsInactive);
        }
        let entity: Entity;

        // initialize callbackで所有を接続する場合や生成時にIsInactiveを付ける場合は、Query初期化前に個体を準備する。
        if (options.initialize !== undefined || inactive !== undefined) {
            entity = allocateEntity(ctx.entityIndex);
            ctx.entityTraits.create(entity);

            // 初期化callbackから再入してもIsInactiveが有効になるよう、先に要求状態へ記録する。
            if (inactive) {
                const eid = getEntityId(entity);
                ctx.entityMasks[inactive.generationId][eid] |= inactive.bitflag;
                // FORK(Entity/batch-spawn): 空のMap/Setでは個体ごとのIteratorを生成しない。
                if (ctx.dirtyMasks.size !== 0) {
                    for (const dirtyMask of ctx.dirtyMasks.values()) {
                        if (!dirtyMask[inactive.generationId]) dirtyMask[inactive.generationId] = [];
                        dirtyMask[inactive.generationId][eid] |= inactive.bitflag;
                    }
                }
                ctx.entityTraits.add(entity, IsInactive);
                if (options.ownerActive === false) markCreatedOwnerInactive(world, entity);
                if (options.enabled === false) disabledEntities(world).add(entity);
            }

            options.initialize?.(entity, index);
            if (!world.has(entity)) throw new Error('Entity ended during construction.');

            // 所有者の初期化を終えてからIsInactiveのQuery通知と購読通知を行う。
            if (inactive) {
                notifyBatchTrait(world, entity, inactive);
                if (inactive.addSubscriptions.size !== 0) {
                    for (const sub of inactive.addSubscriptions) sub(entity);
                }
            }

            if (ctx.notQueries.size !== 0) {
                for (const query of ctx.notQueries) {
                    // 初期化後もIsInactiveを持つ個体は、追加Traitに関係なくforbidden Queryから除外される。
                    const isExcludedByInactive =
                        inactive &&
                        query.traitInstances.forbidden.includes(inactive) &&
                        hasTrait(world, entity, inactive.trait);
                    if (!isExcludedByInactive && query.check(world, entity)) query.add(entity);
                    query.resetTrackingBitmasks(getEntityId(entity));
                }
            }
        } else {
            entity = createEntity(world);
        }

        const traits =
            options.traitsByEntity === undefined
                ? (options.traits ?? noTraits)
                : options.traitsByEntity[index];
        addBatchTraits(world, entity, traits, writesByTraitId, inactive);

        options.complete?.(entity, index);
        entities[index] = entity;
    }
}
