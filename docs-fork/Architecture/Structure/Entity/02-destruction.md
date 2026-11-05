---
date: 2026-09-06T23:52
updated: 2026-11-05T12:39
---

# Entity削除と再入

Entityの削除は同期操作。autoDestroyのsource/target指定に従いRelationの連鎖対象も処理する。削除通知から別Entityのdestroyを呼んだ場合、内側の呼出しの処理を終えてから外側の通知へ戻り、外側の削除待ちは保持する。別Worldへの呼出しでも同様。

一つの外側の削除操作とその再入中では、処理開始済みのEntityへのdestroyを重ねても再処理しない。重複した連鎖先と自分自身への再入で二重解放・無限再帰を起こさない。Entityの世代を含むidentityで判定し、再利用後の別世代を旧個体と同一視しない。外側の操作終了後に破棄済み参照へdestroyを呼ぶとthrowする。

通知の例外はその呼出し元へ伝わり、その呼出しの未処理の削除待ちを打ち切る。内側の例外を利用側が捕捉した場合、外側の削除待ちは継続できる。既に変更した状態や通知を巻き戻さず、失敗した削除連鎖を自動再試行しない。外側まで例外が伝わっても内部の一時管理を終了し、後の独立した削除操作へ持ち越さない。失敗前に外れたRelationを復元する保証はない。

## onEntityDestroyで所有先を閉じる

`world.onEntityDestroy(callback)`は、そのWorldでEntityの削除が進んだ時に同期で呼ぶ購読を登録し、解除関数を返します。Traitを指定せず、空のEntityやRelation連鎖の削除も受け取れます。callbackへ渡すのは世代とWorldを含む完全なEntity IDです。次は生成済みのworldを使う例です。

```ts
const ended = new Set<number>()
const unsubscribe = world.onEntityDestroy((entity) => ended.add(entity))
const entity = world.spawn()
entity.destroy()
unsubscribe()
```

各Entityの削除では、次の順序で進めます。

1. Relationの連鎖対象を追加し、Traitを追加順に除去する。
2. maskを消し、Entity IDを解放する。自身の有効要求と所有者からの休止状態を消す。
3. All Queryから除去する。
4. onEntityDestroyの購読者を登録順に呼ぶ。
5. IncludeInactiveだけのQueryを更新し、旧個体のTrait所属記録を除く。

callbackの時点で`world.has(entity)`はfalseです。通常のEntity操作で値やTraitを読み直す段階ではなく、利用側が完全IDで保持する所有記録やScopeを閉じる入口として使います。全Queryの後処理が済んだことを表す通知ではありません。

通知から新しいEntityを生成し、同じslotが別世代へ再利用される場合があります。maskはID解放前に消し、旧個体の後処理は完全IDを照合するため、新しい個体を旧個体の後処理で消しません。

購読の一つがthrowすると後続購読とその削除呼出しの残りを止め、例外を伝えます。ID解放済みなどの完了した変更は残ります。Worldのreset・destroyは既存Entityの削除を通知した後に購読を解除します。購読は別Worldへ伝わりません。

## destroyBatchで所有するEntityをまとめて削除する

`destroyBatch(world, entities)`は、生きている対象を一括で解放し、Queryから取り除いた後に`onEntityDestroy`を入力順に通知します。個別のTrait・Query除去購読、追跡Query、Relation、または削除からの再入がある場合は、入力順に個別削除を使います。

内部のTrait変更履歴は、一括削除でも解放前の所属bitから変更を記録し、slotに保持した行の版を無効にできます。この購読だけなら個別削除への切替は発生しません。
