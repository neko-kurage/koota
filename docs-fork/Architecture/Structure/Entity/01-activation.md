---
date: 2026-09-06T23:52
updated: 2026-11-05T13:18
---

# Entityの有効状態とQuery参加

Entity自身のenabledと外部の参加条件を合成して実効activeを決めます。外部条件は自身の設定を上書きしません。休止は値やTraitを除去せず、通常Queryから除外します。`IncludeInactive`を指定した集合は休止中のEntityも含みます。

## 有効要求と外部gate

| 操作 | 変わる状態 |
| --- | --- |
| `entity.setEnabled(enabled)` | Entity自身の要求。`entity.isEnabled()`で読む |
| `setEntityOwnerActive(entity, active)` | 外部からの参加条件。所有者の実効状態を指定する |
| `entity.isActive()` | 自身の要求と外部gateを合成した、IsInactiveの有無による実効状態 |

[spawnBatch](../../../API/spawn-batch.md)の`enabled: false`は自身の初期要求を、`ownerActive: false`は外部gateを、Query通知より前に設定します。自身の無効要求が残るEntityは、所有者を再開しても通常Queryへ戻りません。削除・世代再利用で旧個体の設定を次の個体へ引き継ぎません。

Query結果は取得時の集合のsnapshotです。readEach/updateEachは通常Queryのcallback直前にEntityの実効状態を確認します。取得時に含まれていたEntityがその番までに再開していれば呼びます。新たな個体を追加せず、呼出し済みの個体を再実行しません。IncludeInactiveの結果では活動状態による除外を行いません。生の配列操作へこの検査を暗黙に追加しません。

## 複数Entityの活動を変える

`setEntitiesOwnerActive(entities, active)`は、同じWorldで直接所有する複数Entityへ所有者の実効状態を反映します。再開時に個別のTrait除去通知や追跡が不要なら、対象の`IsInactive`をまとめて外します。Queryの所属を反映してから購読へ通知します。

利用側が資源を切り替える場合は、`IsInactive`の所属変更を利用側の同期点で読みます。Prefab階層、資源の所有、自動更新の停止は利用側が扱います。
