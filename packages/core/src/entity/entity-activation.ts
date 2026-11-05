import { $internal } from '../common';
import { getEntityId } from './utils/pack-entity';
import { getTraitInstance } from '../trait/trait-instance';
import { withActivationNotifications } from '../query/activation-notifications';
import { IsInactive, IsExcluded } from '../query/query';
import { addTrait, hasTrait, removeTrait, removeTraitFromEntity } from '../trait/trait';
import type { World } from '../world';
import type { TraitInstance } from '../trait/types';
import { getEntityWorld } from './entity';
import { isEntityAlive } from './utils/entity-index';
import type { QueryInstance } from '../query/types';
import type { Entity } from './types';

interface ActivationState {
    /** 自身のenabledがfalseのEntity。 */
    disabled: Set<Entity>;
    // slotで引き、完全世代付きEntityを保持して古い世代の解除から新しい所有者の休止を守る。
    ownerInactiveBySlot: (Entity | undefined)[];
}
const states = new WeakMap<World, ActivationState>();
function state(world: World): ActivationState {
    let value = states.get(world);
    if (!value) {
        value = { disabled: new Set(), ownerInactiveBySlot: [] };
        states.set(world, value);
    }
    return value;
}
function live(entity: Entity): World {
    const world = getEntityWorld(entity);
    if (!world || !world.has(entity) || entity.has(IsExcluded))
        throw new Error('Entity is disposed.');
    return world;
}

export function isEntityEnabled(entity: Entity): boolean {
    const world = live(entity);
    return !states.get(world)?.disabled.has(entity);
}
export function isEntityActive(entity: Entity): boolean {
    live(entity);
    return !entity.has(IsInactive);
}
function apply(world: World, entity: Entity, value: ActivationState): void {
    let inactive = hasTrait(world, entity, IsInactive);
    let shouldBeInactive =
        value.disabled.has(entity) || value.ownerInactiveBySlot[getEntityId(entity)] === entity;
    // 参加判定は既存のforbidden bitmaskへ統合する。毎更新の親階層走査を増やさない。
    while (inactive !== shouldBeInactive) {
        if (shouldBeInactive) addTrait(world, entity, IsInactive);
        else removeTrait(world, entity, IsInactive);
        if (!world.has(entity)) return;
        // 除去購読はmask変更前に呼ばれるため、そこで変わった要求を反映してから確定する。
        inactive = hasTrait(world, entity, IsInactive);
        shouldBeInactive =
            value.disabled.has(entity) || value.ownerInactiveBySlot[getEntityId(entity)] === entity;
    }
}
export function setEntityEnabled(entity: Entity, enabled: boolean): void {
    const world = live(entity);
    if (typeof enabled !== 'boolean') throw new TypeError('enabled must be a boolean.');
    const value = state(world);
    const wasEnabled = !value.disabled.has(entity);
    if (wasEnabled === enabled) return;
    if (enabled) value.disabled.delete(entity);
    else value.disabled.add(entity);
    withActivationNotifications(world, () => apply(world, entity, value));
}
export function setEntityOwnerActive(entity: Entity, active: boolean): void {
    const world = live(entity);
    const value = state(world);
    const slot = getEntityId(entity);
    if (active) {
        if (value.ownerInactiveBySlot[slot] === entity) value.ownerInactiveBySlot[slot] = undefined;
    } else value.ownerInactiveBySlot[slot] = entity;
    withActivationNotifications(world, () => apply(world, entity, value));
}
/** 一括削除で解放した個体の有効状態を消す。状態の検索は一度だけ行う。 */
export function clearEntitiesActivation(world: World, entities: readonly Entity[]): void {
    const value = states.get(world);
    if (!value) return;
    const disabled = value.disabled.size === 0 ? undefined : value.disabled;
    const inactive = value.ownerInactiveBySlot;
    for (let index = 0; index < entities.length; index++) {
        const entity = entities[index];
        disabled?.delete(entity);
        const slot = getEntityId(entity);
        if (inactive[slot] === entity) inactive[slot] = undefined;
    }
}

export function clearEntityActivation(world: World, entity: Entity): void {
    const value = states.get(world);
    if (!value) return;
    const slot = getEntityId(entity);
    value.disabled.delete(entity);
    if (value.ownerInactiveBySlot[slot] === entity) value.ownerInactiveBySlot[slot] = undefined;
}

export function setEntitiesOwnerActive(entities: readonly Entity[], active: boolean): void {
    if (!entities.length) return;
    const world = getEntityWorld(entities[0]);
    if (!world) return;
    const value = state(world);
    const ctx = world[$internal];
    const excludedInstance = getTraitInstance(ctx.traitInstances, IsExcluded)!;
    const inactiveInstance = getTraitInstance(ctx.traitInstances, IsInactive)!;
    // FORK(Entity/batch-publication): 個体ごとの通知が要らなければ、所有者の再開をまとめて反映する。
    // Query購読は全個体のQuery参加を整えた後に通知する。
    if (
        active &&
        inactiveInstance.removeSubscriptions.size === 0 &&
        inactiveInstance.trackingQueries.size === 0 &&
        [...inactiveInstance.queries].every((query) => !query.relationFilters?.length)
    ) {
        withActivationNotifications(world, () =>
            activateEntities(world, entities, value, inactiveInstance)
        );
        return;
    }
    // 所有者の切替では全個体のQuery参加を整えた後に利用側へ通知する。
    withActivationNotifications(world, () => {
        for (const entity of entities) {
            if (!world.has(entity)) continue;
            const slot = getEntityId(entity);
            const excludedMask = ctx.entityMasks[excludedInstance.generationId][slot];
            if ((excludedMask & excludedInstance.bitflag) !== 0) continue;

            if (active) {
                if (value.ownerInactiveBySlot[slot] === entity)
                    value.ownerInactiveBySlot[slot] = undefined;
                if (!value.disabled.has(entity) && inactiveInstance.removeSubscriptions.size === 0) {
                    // 除去通知が不要なら、準備済みinstanceでmaskとQueryを更新する。
                    removeTraitFromEntity(world, entity, IsInactive, inactiveInstance);
                    continue;
                }
            } else {
                value.ownerInactiveBySlot[slot] = entity;
            }

            apply(world, entity, value);
        }
    });
}

// FORK(Entity/batch-spawn): 新規個体のQuery初期化より前に、所有者の休止だけを記録する。
export function markCreatedOwnerInactive(world: World, entity: Entity): void {
    state(world).ownerInactiveBySlot[getEntityId(entity)] = entity;
}

// FORK(Entity/batch-spawn): 一括生成で所有者が休止している個体を、slotごとの完全IDで記録する列。
export function ownerInactiveSlots(world: World): (Entity | undefined)[] {
    return state(world).ownerInactiveBySlot;
}

// FORK(Entity/batch-spawn): 初期無効状態はQuery参加前に要求状態へ保存する。
export function disabledEntities(world: World): Set<Entity> {
    return state(world).disabled;
}

/** 所有者が再開した個体のmaskを更新し、同じmaskが続く個体には同じQueryの追加・除去を適用する。 */
function activateEntities(
    world: World,
    entities: readonly Entity[],
    value: ActivationState,
    inactiveInstance: TraitInstance
): void {
    const ctx = world[$internal];
    const entityIndex = ctx.entityIndex;
    const entityMasks = ctx.entityMasks;
    const entityTraits = ctx.entityTraits;
    const excludedInstance = getTraitInstance(ctx.traitInstances, IsExcluded)!;
    const excludedMask = entityMasks[excludedInstance.generationId];
    const excludedBit = excludedInstance.bitflag;
    const generation = inactiveInstance.generationId;
    const inactiveMask = entityMasks[generation];
    const inactiveBit = inactiveInstance.bitflag;
    const observer = ctx.traitRemovalObservers?.get(inactiveInstance);
    const ownerInactive = value.ownerInactiveBySlot;
    const disabled = value.disabled;
    const dirtyMasks = [...ctx.dirtyMasks.values()];
    const queries = [...inactiveInstance.queries];
    // 直前の個体のmaskと、そのmaskで追加・除去するQuery。NaNはどのmaskとも一致しない。
    const signature = new Array<number>(entityMasks.length).fill(NaN);
    const targets: QueryInstance[] = [];
    const additions: boolean[] = [];
    // 購読のないQueryへの追加は、同じmaskの区間ごとにまとめる。
    const run: Entity[] = [];
    let eachEntity = false;

    for (let index = 0; index < entities.length; index++) {
        const entity = entities[index];
        if (!isEntityAlive(entityIndex, entity)) continue;
        const slot = getEntityId(entity);
        if ((excludedMask[slot] & excludedBit) !== 0) continue;
        if (ownerInactive[slot] === entity) ownerInactive[slot] = undefined;
        if (disabled.size !== 0 && disabled.has(entity)) continue;
        if ((inactiveMask[slot] & inactiveBit) === 0) continue;
        inactiveMask[slot] &= ~inactiveBit;
        observer?.removed(entity);
        for (let mask = 0; mask < dirtyMasks.length; mask++)
            dirtyMasks[mask][generation][slot] |= inactiveBit;
        entityTraits.remove(entity, IsInactive);

        let same = true;
        for (let maskGeneration = 0; maskGeneration < signature.length; maskGeneration++) {
            const mask = entityMasks[maskGeneration][slot] ?? 0;
            if (mask !== signature[maskGeneration]) {
                signature[maskGeneration] = mask;
                same = false;
            }
        }
        if (!same) {
            addRun(run, targets, additions);
            // 一致するQueryには通常のTrait除去と同じく追加を通知し、
            // 外れるQueryは再開前に参加していたものだけを除去する。
            targets.length = 0;
            additions.length = 0;
            eachEntity = false;
            for (const query of queries) {
                const matches = query.check(world, entity);
                if (!matches && !(query.entities.has(entity) && !query.toRemove.has(entity)))
                    continue;
                targets.push(query);
                additions.push(matches);
                eachEntity ||= !matches || query.addSubscriptions.size !== 0;
            }
        }

        run.push(entity);
        if (!eachEntity) continue;
        // 購読のあるQueryと除去は、従来どおり個体ごとに通知を予約する。
        for (let target = 0; target < targets.length; target++) {
            const query = targets[target];
            if (!additions[target]) query.remove(world, entity);
            else if (query.addSubscriptions.size !== 0) query.add(entity);
        }
    }
    addRun(run, targets, additions);
}

/** 購読のない一致Queryへ、区間の個体をまとめて追加する。 */
function addRun(run: Entity[], targets: readonly QueryInstance[], additions: readonly boolean[]) {
    if (run.length === 0) return;
    for (let target = 0; target < targets.length; target++) {
        const query = targets[target];
        if (!additions[target] || query.addSubscriptions.size !== 0) continue;
        if (query.toRemove.length !== 0) {
            for (let index = 0; index < run.length; index++) query.toRemove.remove(run[index]);
        }
        query.entities.addAll(run);
        query.version += run.length;
    }
    run.length = 0;
}
