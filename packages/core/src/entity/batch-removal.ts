import { $internal } from '../common';
import type { World } from '../world';
import { clearEntitiesActivation } from './entity-activation';
import { destroyEntity, isEntityDestroyInProgress } from './entity';
import type { Entity } from './types';
import { isEntityAlive, releaseEntity } from './utils/entity-index';
import { getEntityId } from './utils/pack-entity';

// FORK(Entity/batch-destroy): 内部履歴を記録し、全個体の所属とIDを解放してから公開削除通知を行う。
// 途中の通知・追跡・Relationが必要なWorldでは、既存の個別削除が通知と連鎖を処理する。
export function destroyBatch(world: World, entities: readonly Entity[]): void {
    if (!canDestroyTogether(world)) {
        for (let index = 0; index < entities.length; index++) {
            const entity = entities[index];
            if (world.has(entity)) destroyEntity(world, entity);
        }
        return;
    }

    const ctx = world[$internal];
    const { entityIndex, entityMasks, entityTraits } = ctx;
    const dirtyMasks = [...ctx.dirtyMasks.values()];
    const observers = ctx.traitRemovalObservers;
    const removalObservers = observers === undefined ? undefined : [...observers];
    const removed = new Array<Entity>(entities.length);
    let removedCount = 0;
    for (let index = 0; index < entities.length; index++) {
        const entity = entities[index];
        if (!isEntityAlive(entityIndex, entity)) continue;
        const slot = getEntityId(entity);
        if (removalObservers !== undefined) {
            for (let observerIndex = 0; observerIndex < removalObservers.length; observerIndex++) {
                const entry = removalObservers[observerIndex];
                const trait = entry[0];
                const mask = entityMasks[trait.generationId][slot];
                entry[1].released(entity, slot, (mask & trait.bitflag) !== 0);
            }
        }
        for (let generation = 0; generation < entityMasks.length; generation++) {
            const mask = entityMasks[generation][slot];
            if (!mask) continue;
            for (let dirtyIndex = 0; dirtyIndex < dirtyMasks.length; dirtyIndex++) {
                const dirty = dirtyMasks[dirtyIndex];
                (dirty[generation] ??= [])[slot] |= mask;
            }
            entityMasks[generation][slot] = 0;
        }
        entityTraits.release(slot);
        releaseEntity(entityIndex, entity);
        removed[removedCount++] = entity;
    }
    removed.length = removedCount;

    for (const query of ctx.queriesHashMap.values()) {
        const count = query.entities.length;
        query.entities.removeAll(removed);
        query.version += count - query.entities.length;
    }
    clearEntitiesActivation(world, removed);

    const callbacks = [...ctx.entityDestroySubscriptions];
    for (let index = 0; index < removedCount; index++) {
        for (let callback = 0; callback < callbacks.length; callback++)
            callbacks[callback](removed[index]);
    }
}

function canDestroyTogether(world: World): boolean {
    const { relations, traitInstances, queriesHashMap } = world[$internal];
    if (isEntityDestroyInProgress() || relations.size !== 0) return false;
    for (const trait of traitInstances) {
        if (trait === undefined) continue;
        if (trait.removeSubscriptions.size !== 0 || trait.trackingQueries.size !== 0) return false;
    }
    for (const query of queriesHashMap.values()) {
        if (query.removeSubscriptions.size !== 0) return false;
    }
    return true;
}
