import { clearEntityActivation } from './entity-activation';
import { $internal } from '../common';
import { getEntitiesWithRelationTo, getRelationTargets } from '../relation/relation';
import { addTrait, cleanupRelationTarget, removeTrait } from '../trait/trait';
import type { ConfigurableTrait } from '../trait/types';
import { universe } from '../universe/universe';
import type { World } from '../world';
import type { Entity } from './types';
import { allocateEntity, releaseEntity } from './utils/entity-index';
import { getEntityId, getEntityWorldId } from './utils/pack-entity';

// Ensure entity methods are patched.
import './entity-methods-patch';

export function createEntity(world: World, ...traits: ConfigurableTrait[]): Entity {
    const ctx = world[$internal];
    const entity = allocateEntity(ctx.entityIndex);

    for (const query of ctx.notQueries) {
        const match = query.check(world, entity);
        if (match) query.add(entity);
        // Reset all tracking bitmasks for the query.
        query.resetTrackingBitmasks(getEntityId(entity));
    }

    ctx.entityTraits.create(entity);
    addTrait(world, entity, ...traits);

    return entity;
}

const cachedSet = new Set<Entity>();
const cachedQueue = [] as Entity[];
let destroyDepth = 0;

// FORK(Entity/batch-destroy): 削除の通知から再入した一括削除は、1体ずつの削除へ戻す。
export function isEntityDestroyInProgress(): boolean {
    return destroyDepth > 0;
}

export function destroyEntity(world: World, entity: Entity) {
    const ctx = world[$internal];

    // FORK(Entity/reentrant-destroy): 外側の削除待ちを残して、内側の呼出しを同期処理する。
    // 同じ個体への再入は二重解放せず、通常の破棄済み参照への操作は従来どおり拒否する。
    if (destroyDepth > 0 && cachedSet.has(entity)) return;
    if (!world.has(entity)) throw new Error('Koota: The entity being destroyed does not exist.');

    const entityQueue = cachedQueue;
    const processedEntities = cachedSet;
    const queueStart = entityQueue.length;
    destroyDepth++;
    entityQueue.push(entity);

    try {
        // Destroyed entities may be the target or source of relations.
        // To avoid stale references, all these relations must be removed.
        // autoDestroy controls cascade behavior:
        // - 'source' (or 'orphan'): when target dies, destroy sources (e.g., parent dies → children die)
        // - 'target': when source dies, destroy targets (e.g., container dies → items die)
        while (entityQueue.length > queueStart) {
            const currentEntity = entityQueue.pop()!;
            if (processedEntities.has(currentEntity)) continue;

            processedEntities.add(currentEntity);

            for (const relation of ctx.relations) {
                const relationCtx = relation[$internal];

                // Handle entities that have relations pointing TO currentEntity (currentEntity is target)
                // If autoDestroy is 'orphan', destroy those sources
                const sources = getEntitiesWithRelationTo(world, relation, currentEntity);
                for (let sourceIndex = sources.length - 1; sourceIndex >= 0; sourceIndex--) {
                    const source = sources[sourceIndex];
                    if (!world.has(source)) continue;

                    cleanupRelationTarget(world, relation, source, currentEntity);

                    if (relationCtx.autoDestroy === 'source') entityQueue.push(source);
                }

                // Handle relations where currentEntity is the source pointing to targets
                // If autoDestroy is 'target', destroy those targets
                if (relationCtx.autoDestroy === 'target') {
                    const targets = getRelationTargets(world, relation, currentEntity);
                    for (const target of targets) {
                        if (!world.has(target)) continue;
                        if (!processedEntities.has(target)) entityQueue.push(target);
                    }
                }
            }

            // Callbacks may remove or re-add traits; keep processing them in addition order.
            const entityTraits = ctx.entityTraits;
            if (entityTraits.beginRemoval(currentEntity)) {
                try {
                    for (
                        let traitIndex = 0;
                        traitIndex < entityTraits.count(currentEntity);
                        traitIndex++
                    ) {
                        const trait = entityTraits.at(currentEntity, traitIndex);
                        if (trait !== undefined) removeTrait(world, currentEntity, trait);
                    }
                } finally {
                    entityTraits.endRemoval(currentEntity);
                }
            }

            // FORK(Entity/destroy-notification): 解放後の通知から同じslotを再利用できるため、maskは解放前に消す。
            const entityId = getEntityId(currentEntity);
            for (let generationId = 0; generationId < ctx.entityMasks.length; generationId++) {
                ctx.entityMasks[generationId][entityId] = 0;
            }

            // Free the entity.
            releaseEntity(ctx.entityIndex, currentEntity);
            clearEntityActivation(world, currentEntity);

            // Query通知から再入して同じslotを使う前に、古いTrait履歴を消す。
            const observers = ctx.traitRemovalObservers;
            if (observers !== undefined) {
                for (const observer of observers.values()) {
                    observer.released(currentEntity, entityId, false);
                }
            }

            // Remove the entity from the all query.
            const allQuery = ctx.queriesHashMap.get('');
            if (allQuery) allQuery.remove(world, currentEntity);
            // FORK(Entity/destroy-notification): ID・activation・All Query更新後、IncludeInactive Query更新前に同期通知する。
            // 例外時は残りの除去を行わず、そのまま伝播する。
            for (const callback of ctx.entityDestroySubscriptions) callback(currentEntity);

            // FORK(Prefab/entity-activation): IncludeInactiveだけの集合も、Traitが空の削除を受け取る。
            const allDisabledQuery = ctx.queriesHashMap.get('-1');
            if (allDisabledQuery) allDisabledQuery.remove(world, currentEntity);

            // FORK(Entity/destroy-query): Trait除去の途中で否定条件に一致した個体も、解放後に外す。
            for (const query of ctx.notQueries) query.remove(world, currentEntity);

            // Remove all entity state from world.
            ctx.entityTraits.delete(currentEntity);
        }
    } finally {
        // 例外ではこの呼出しの未処理分だけを捨てる。外側の待ち一覧とゲーム状態は戻さない。
        entityQueue.length = queueStart;
        if (--destroyDepth === 0) processedEntities.clear();
    }
}

/* @inline @pure */ export function getEntityWorld(entity: Entity) {
    const worldId = getEntityWorldId(entity);
    return universe.worlds[worldId]!;
}
