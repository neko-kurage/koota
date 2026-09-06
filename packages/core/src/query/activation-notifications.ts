import { $internal } from '../common';
import type { World } from '../world';
import type { Entity } from '../entity/types';
import type { QuerySubscriber } from './types';
const internal = new WeakSet<QuerySubscriber>();
export function internalSubscription(callback: QuerySubscriber): QuerySubscriber {
    internal.add(callback);
    return callback;
}
export function notifyQuery(world: World, callback: QuerySubscriber, entity: Entity): void {
    const pending = world[$internal].activationNotifications;
    if (pending && !internal.has(callback)) pending.push([callback, entity]);
    else callback(entity);
}
// FORK(Prefab/entity-activation): Query索引を整えてから利用側へ通知する。
// game stateは戻さず、例外後は残りの利用側callbackを実行しない。
export function withActivationNotifications(world: World, operation: () => void): void {
    const ctx = world[$internal];
    if (ctx.activationNotifications) {
        operation();
        return;
    }
    const pending: [QuerySubscriber, Entity][] = [];
    ctx.activationNotifications = pending;
    try {
        operation();
    } finally {
        ctx.activationNotifications = undefined;
    }
    for (const [callback, entity] of pending) callback(entity);
}
