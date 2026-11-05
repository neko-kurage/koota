---
date: 2026-11-04T01:38
updated: 2026-11-05T13:18
---

# Entityの一括生成

`spawnBatch(world, count, options)`は、指定したWorldへEntityを生成し、生成順の配列を返します。同じ構成の保存先とQuery照合を呼出し単位で準備し、個別の初期値も渡せます。

```ts
import { createWorld, spawnBatch, trait } from 'koota'

const Position = trait(Object.freeze({ x: 0, y: 0 }))
const Velocity = trait(Object.freeze({ x: 1, y: 1 }))
const world = createWorld()
const entities = spawnBatch(world, 10_000, { traits: [Position, Velocity] })
world.destroy()
```

## optionsと初期値

| 引数・field | 意味 |
| --- | --- |
| `world` | 生成先のWorld |
| `count` | 0以上、`0xffffffff`以下の安全な整数。0なら空配列を返す |
| `traits` | 全Entityへ加えるTraitと設定値の列。省略時は空 |
| `traitsByEntity` | EntityごとのTraitと設定値の列。指定時は`traits`より優先し、count件以上を必要とする |
| `enabled` | Entity自身の初期有効要求。既定はtrue。falseならQueryへ参加する前にIsInactiveを設定する |
| `ownerActive` | 所有者の実効状態。既定はtrue。falseなら所有者の再開まで通常Queryから除外する |
| `initialize(entity, index)` | 観測される通知より先に所有先へ接続する同期callback |
| `complete(entity, index)` | initializeと生成通知を終えた後の同期callback |

個体ごとの値を渡す場合も、保存は通常のTraitと同じsetterを使います。上の例のspawnBatch呼出しを、次の形へ置き換えられます。値の配列は呼出し前に用意します。

```ts
const traitsByEntity = Array.from({ length: 10_000 }, (_, index) => [
  Position({ x: index, y: 0 }),
  Velocity,
])
const entities = spawnBatch(world, traitsByEntity.length, { traitsByEntity })
```

全件を同じTrait・同じ順で指定すると、その構成の準備を共有できます。構成が異なる場合も生成できますが、個体ごとの経路を使います。Relation・AoS・順序付きTrait、共有できない既定値や追跡Queryなど、個体ごとの保存・照合を要する条件でも同様です。

`enabled: false`と`ownerActive: false`を同時に指定した場合、`setEntityOwnerActive(entity, true)`で所有者を再開してもEntity自身の無効要求は残ります。自身の要求は`entity.setEnabled(true)`で変えます。[有効状態とQuery参加](../Architecture/Structure/Entity/01-activation.md)を参照してください。

## 所有接続と通知の順序

`initialize`と`complete`は利用側の所有記録を接続する入口です。Worldを変更する処理を置かず、生成時の値は`traits`または`traitsByEntity`へ渡します。

一つの構成をまとめて保存できる場合は、次の順序です。

1. 全EntityのID・Trait所属・値を保存し、Queryの集合へ追加する。
2. 全Entityの`initialize`を生成順に呼ぶ。
3. Entityの生成順に、一致Queryの追加購読、Traitの追加購読の順で通知する。
4. 全Entityの`complete`を生成順に呼ぶ。

通常Queryは、初期状態が有効なEntityをinitializeから取得できます。構築中の公開を隠す用途では、呼出し側が`ownerActive: false`を指定します。先の通知で破棄されたEntityへの後続通知や、initialize後に一致から外れたEntityへの古いQuery追加通知は配送しません。

Relationなどを個体ごとに保存する経路では、各Entityについて所有接続、Trait保存と通知、completeを終えてから次のEntityへ進みます。この経路のinitializeはTrait追加前です。両経路で同じ途中状態が観測できるという保証はなく、通知のある構成すべてを全件保存後へまとめるわけではありません。

## 失敗と生成済みのEntity

成功済みの保存・通知・外部の所有記録は巻き戻しません。全件保存の経路でinitializeが失敗した場合は、そのEntityと後続の未接続Entityを破棄し、先に所有接続したEntityは利用側の責任で終了します。通知またはcompleteの失敗では、後続の通知・callbackを打ち切って例外を伝えます。例外後に全生成物を自動破棄する契約ではありません。

[EntityのTrait一覧](entity-traits.md) / [資料入口](../00_index.md)
