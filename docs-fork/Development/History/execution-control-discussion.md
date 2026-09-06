# Entity・Prefab・機能の制御：議論の整理

2026-09-06のneko側検討を取り込んだ参考snapshot。最新のAPI議論はneko側を正本とし、この資料の状態を更新台帳として扱わない。現行実装の基準は`442b5f7`。**現在の安定契約を変更する文書ではない。** 作業状態は[処理と機能の有効化 Audit](../../../../neko-threejs/docs/Development/13-trait-participation-audit.md)を正本とする。

## 現時点の方向性

- 利用者がComponent・Systemごとに切替関数を実装する方式ではなく、System／Prefabの標準機能として制御を提供する。
- 一つの追加概念で、Prefab範囲のInput受付、local System、直接書いたcallbackなどを自然に扱えるかを検討する。activity、Tag、Kootaの既存APIの形を先に制約にしない。
- 既存機能を対象として指定する有効化は、利用者が支持した方向。`setEnabled`という名前、引数、制御範囲の最終仕様は未確定。
- Prefab local Systemへの対応は必須。停止のためだけに独立したSystemへ書き直させない。
- Entity個別対応を一度除外する方向で話したが、既存APIの比較により再検討へ戻った。**Entity個別対応を対象外として確定しない。**
- ユーザーはKootaをフォークする方向を提示した。フォークを避けることを優先してAPIを曲げず、ECS本体とneko側の適切な責務を選ぶ。この議論時点ではfork作成・依存切替・本体の実装は未着手だった。現在の環境整備状況はKoota側Auditを参照する。

## 満たしたい利用場面

| 場面             | 停止対象                               | 継続・保持したいもの              |
| ---------------- | -------------------------------------- | --------------------------------- |
| Scene遷移        | 旧Sceneの入力受付                      | 描画、退場演出、Entityの状態      |
| 複数PrefabのUI   | 共通の受付を使うButton・Slider等の入力 | 各Prefab自身が持つ操作処理        |
| UI個別の操作禁止 | 特定UIの入力                           | 表示、他UIの入力                  |
| 気絶など         | 移動・攻撃                             | 被ダメージ、描画、速度等の値      |
| 再開             | 必要な処理だけ再開                     | 初期化済み状態・awake所有resource |

簡単な切替はboolで一行にし、対象をIDEで補完できることを重視する。停止のためだけにEntityやPrefabを不自然に分割しない。将来の子spawnへの継承、親と子の個別設定、複数停止理由も検討に含める。

## EntityとPrefabの現状比較

以下は中断した試作を除いた、基準revisionの公開機能。Prefabは生成済みInstanceを指す。Entity個別の機能が少ないとした説明は不正確であり、状態操作・処理・所有・破棄は既に個別対応している。

| 機能               | Entity単位                                 | Prefab単位                                 |
| ------------------ | ------------------------------------------ | ------------------------------------------ |
| 生成               | Prefab生成時に作る。公開の単独spawnはない  | World／親Instanceからspawn                 |
| 初期値             | traits(props, index)で一体ずつ指定         | spawn時にpropsを指定                       |
| Trait・Tag         | add/remove/has                             | 所属Entityを通して操作                     |
| 値                 | get/set、Queryで個別・一括操作             | 直接のTrait値は持たない                    |
| 対象選択           | Query・System select                       | fromで所属範囲を指定                       |
| 初期化             | entity.awake、selected Systemのawake       | Prefab直下awake、selectなしlocal System    |
| 更新               | entity.fixedUpdate/update、selected System | selectなしlocal SystemでInstanceごとに更新 |
| 活動通知           | EntityごとのonEnable/onDisableあり         | Prefab側にもあり                           |
| 独立した停止・再開 | 公開APIなし                                | instance.setEnabled(bool)                  |
| resourceの所有     | Entity側callbackのownerへownで登録         | Prefab側ownerへ登録                        |
| 描画               | selected awakeからEntityへ接続             | disableで配下の表示を休止                  |
| Event購読          | Entity側callbackの所有期間へ接続可能       | Instance側でも購読可能                     |
| 関係               | Entity間Relation                           | 子Prefabの所有階層                         |
| 破棄               | world.destroy(entity)、ctx.destroy()       | instance.dispose()で配下を終了             |

Entity側の活動通知は、Entityを独立して有効化できることを意味しない。現在は所属Prefab等の活動状態に従う。ownや購読の具体的な寿命はcallback owner／System matchに従い、Entity参照自体が自由な所有コンテナになるわけではない。Eventの所有元をEntityにしても、Event自体の配送先がそのEntity限定になるわけではない。

```ts
// 現行で可能：count内の一体だけを変更・破棄する。
const group = world.spawn(EnemyGroup)
const first = group.entities[0]!
first.set(Health, { value: 10 })
first.add(Stunned)
world.destroy(first)
```

```ts
// 未対応の利用形。上の破棄済みEntityを操作する例ではない。
first.setEnabled(false)
first.setEnabled(Move, false)
```

課題は「Entityを個体として扱えない」ことではなく、**個体の活動を独立して停止・再開する標準入口がない**こと。

## 比較した表現と現在の優先順位

```ts
// すべて提案。対象指定の有効化は未実装。
scene.setEnabled(Input.Component, false)
enemy.setEnabled(Move, false)

scene.control(Input.Component).setEnabled(false)
scene.control(Input.Component).enabled = false
```

control handleは設定値と実効状態を読む入口になり得るが、そのためだけに新しい参照・概念を増やす必要があるかは未確認。ユーザーは表記の好みより、Component／Systemごとに個別関数を作らず標準機能で対応することを優先した。現在は直接対象を渡す案を基準にし、名前は確定しない。

`ctx.setEnabled(...)`も候補に挙がったが、selected callbackでEntityを対象にするか、所属Prefabを対象にするかは未決定。Entity個別対応の除外を撤回しているため、「常に所属Prefab」と確定したものとして扱わない。

## local Systemで欠かせない三経路

1. `systems: [Move]`としてPrefabへattachしたSystem。enemyAの設定で同じ定義を使うenemyBまで止めない。
2. `entity.fixedUpdate`などPrefabへ直接書いたcallback。独立したMoveという名前がなくても制御できる必要がある。
3. Worldのselected SystemからそのPrefabのEntityを扱う経路。localとWorldで同じ対象の有効状態が矛盾しないようにする。

直接書いたcallbackをPrefab定義で指定する案は[機能別制御草案](../../../../neko-threejs/docs/Development/History/15-scoped-feature-control-research.md)にあるが未確定。Prefab rootとentity callbackを同時に扱うかも含め、入口を先に固定しない。

## ライフサイクルとComponentの区別

awake/onEnable/fixedUpdate/update/onDisableを総称してライフサイクルcallbackと呼ぶ。生成時の初期化、活動の開始・終了、繰返し更新の違いは残す。

基盤は対象の解決・親子継承・有効状態・callback呼出しを担当する。自作Systemに固有の切替関数を書かせない。Inputの中立化、Renderの非表示、Timelineの休止など、Componentごとに異なる停止動作は共通の接続口へ登録する方向。任意operationを一律に無操作へ置換するだけでは、戻り値や初期化の契約を壊す。

Componentの活動をSystemの休止とどう分離するかは、現在のcallback ownerへの接続からの契約変更を伴う。Eventも独立した配送経路なので、ライフサイクルの呼出しを止めれば自動的に全購読も止まるとは扱わない。活動中だけ必要な購読をonEnableへ置く案はあるが、最終契約は未確定。

## Kootaフォークについての訂正と方向性

`first.setEnabled()`がない理由を「Kootaにないからだけ」と断定しない。現在はKootaの数値Entityをほぼそのまま公開しているため、独自メソッドを自然に追加しにくい。一方、`world.setEntityEnabled(entity, false)`のような操作はフォークなしでも設計可能。

フォークは不可能な機能を可能にする唯一の手段ではなく、外側の補完が複雑になるならECS本体に狭い変更を置く選択肢。ユーザーはフォークする方向を提示しており、次はその前提を許容して変更範囲を比較する。

| Koota側で検討する責務         | neko側に残る責務                       |
| ----------------------------- | -------------------------------------- |
| Entity／Traitの有効状態の表現 | Prefab親子への伝播                     |
| Queryの一致判定への統合       | Systemのライフサイクルとmatch lifetime |
| Entity操作API                 | Input・Render・Timelineの機能別休止    |
| 有効状態の保持・更新費用      | resourceの所有・cleanup                |

初回の比較候補はEntityの有効状態とQueryへの反映を扱う小さいfork。Trait別enableまで同時採用する合意ではない。値保持・休止・再開・世代再利用・Queryの結果が成立し、neko側の重複処理を減らせるかを確認する。forkなら性能が上がる、単一APIで全要件が解決するとは未測定で主張しない。

## 未決事項と次に行うこと

- Entity全体、Trait単位、System単位、Component利用単位のうち、どの状態をどのownerへ置くか。
- Entity個別切替とPrefab配下切替の合成、count内の個体の扱い。
- 公開API名・receiver・引数と、直接書いたcallbackの指定方法。
- 同じownerへの複数停止理由、非階層の共有受付、World bulk Queryの扱い。
- Input定義を共有した旧新Sceneの受付分離と再開時のedge、停止前の指示値の扱い。
- forkの取得元revision、保存形態、依存の固定方法、上流更新手順。repositoryやbranchの作成はまだ行っていない。

次は責務と最小fork差分を先に定め、forkなしの外側実装と比較する。実験では未使用・使用・休止・切替、値保持・cleanup・Query整合性と上流差分を評価する。効果があれば採用し、効果がなければ性能同等でコードが理解しやすくなる場合だけ残す。runtimeのゲーム状態rollbackは追加しない。

## ここに至る比較資料

- [Tagによる更新条件の草案](../../../../neko-threejs/docs/Development/History/14-tag-update-conditions-draft.md)：Tagの初期配置・selectと所有期間・whenの分離を比較。採用保留。
- [他エンジン調査と機能別制御案](../../../../neko-threejs/docs/Development/History/15-scoped-feature-control-research.md)：Unity、Unreal、Godot、Bevy、Phaser、Babylonの一次資料、InputとSystemの共通操作案と限界。

この整理では文書だけを更新した。中断したTrait参加切替のコードはユーザーの指示で保持しており、動作・型・性能が確認された実装として扱わない。
