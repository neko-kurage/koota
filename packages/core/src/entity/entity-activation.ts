import { withActivationNotifications } from '../query/activation-notifications';
import { IsDisabled, IsExcluded } from '../query/query';
import type { World } from '../world';
import { getEntityWorld } from './entity';
import type { Entity } from './types';

export interface EntityActivationBinding {
    beforeChange(entity: Entity, enabled: boolean): void;
    changed(entity: Entity, enabled: boolean): void;
    failure(): void;
}

interface ActivationState {
    disabled: Set<Entity>;
    gates: Set<Entity>;
    binding?: EntityActivationBinding;
}
const states = new WeakMap<World, ActivationState>();
function state(world: World): ActivationState {
    let value = states.get(world);
    if (!value) {
        value = { disabled: new Set(), gates: new Set() };
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

// FORK(Prefab/entity-activation): World単位の接続口。PrefabやScopeの型をECSへ持ち込まない。
export function bindEntityActivation(world: World, binding: EntityActivationBinding): void {
    const value = state(world);
    if (value.binding) throw new Error('Entity activation is already bound.');
    value.binding = binding;
}
export function isEntityEnabled(entity: Entity): boolean {
    const world = live(entity);
    return !states.get(world)?.disabled.has(entity);
}
export function isEntityActive(entity: Entity): boolean {
    live(entity);
    return !entity.has(IsDisabled);
}
function apply(entity: Entity, value: ActivationState): void {
    const disabled = value.disabled.has(entity) || value.gates.has(entity);
    if (entity.has(IsDisabled) === disabled) return;
    // 参加判定は既存のforbidden bitmaskへ統合する。毎更新の親階層走査を増やさない。
    if (disabled) entity.add(IsDisabled);
    else entity.remove(IsDisabled);
}
export function setEntityEnabled(entity: Entity, enabled: boolean): void {
    const world = live(entity);
    if (typeof enabled !== 'boolean') throw new TypeError('enabled must be a boolean.');
    const value = state(world);
    try {
        value.binding?.beforeChange(entity, enabled);
        if (value.disabled.has(entity) === !enabled) return;
        if (enabled) value.disabled.delete(entity);
        else value.disabled.add(entity);
        withActivationNotifications(world, () => {
            apply(entity, value);
            value.binding?.changed(entity, enabled);
        });
    } catch (error) {
        value.binding?.failure();
        throw error;
    }
}
export function setEntityEnabledGate(entity: Entity, enabled: boolean): void {
    const world = live(entity);
    const value = state(world);
    if (enabled) value.gates.delete(entity);
    else value.gates.add(entity);
    withActivationNotifications(world, () => apply(entity, value));
}
export function clearEntityActivation(world: World, entity: Entity): void {
    const value = states.get(world);
    value?.disabled.delete(entity);
    value?.gates.delete(entity);
}

export function setEntitiesEnabledGate(entities: readonly Entity[], enabled: boolean): void {
    if (!entities.length) return;
    const world = getEntityWorld(entities[0]);
    if (!world) return;
    // 親切替では全個体のQuery参加を整えた後に利用側へ通知する。
    withActivationNotifications(world, () => {
        for (const entity of entities)
            if (world.has(entity) && !entity.has(IsExcluded)) setEntityEnabledGate(entity, enabled);
    });
}
