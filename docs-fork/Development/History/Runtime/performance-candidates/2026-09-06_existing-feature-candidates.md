# 現行機能をKoota forkで改善できるか

2026-09-06の調査記録。対象はneko `442b5f7`と導入済みKoota 0.6.6。変更中のecs/query・adapter・SystemAttachmentはHEADとも比較し、**中断中のTraitParticipation試作を現行機能や改善根拠へ数えない**。[有効化の議論](../../../Discussion/Prefab/entity-activation/2026-09-06_execution-control-discussion.md)に加え、既存機能の速度・コード構造を改善する余地を調べた。

作業状態と候補IDの正本は[性能Audit](../../../audit.md)。今回は調査とコピー回数確認のみ。fork・本体実装・時間比較は未実施。

## 結論

改善候補はある。最初に手を付けるなら、Entity APIの拡張よりも、**既存Queryの不要copy除去と、Query結果を外側から加工するための正式な入口**が狭く、効果やコード削減を確認しやすい。

Vectorと選択付きSystemの更新経路の統合には大きな余地がある一方、過去に直接SoA化でscalarが悪化している。forkしただけでその問題が消えるわけではない。コードをnekoからforkへ移しただけの変更は、全体の保守性向上として数えない。

## 候補一覧

性能欄は可能性の評価。コピー数以外の改善は未測定。上流との差分が小さい候補は、長期fork専用にせず上流へ戻す余地もある。

| ID            | 現行機能・候補                                           | 性能の見込み                               | コードの整理                                    | fork必要性・規模                                  |
| ------------- | -------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------- | ------------------------------------------------- |
| KOOTA-PERF-01 | 通常Queryの二重copyと、除外反映loopの繰返しcopyを除く    | 不要copyは実行確認済み。時間改善は未測定   | 小さい。意図が直接的になる                      | Koota内部の小さい修正。patch／上流修正でも可能    |
| KOOTA-PERF-02 | Query結果への正式な絞込み入口                            | 条件次第。独自predicateによる走査は残る    | readonly配列の内部cast・破壊的加工をなくせる    | 小〜中。外側実装も可能だが正式な結果APIが自然     |
| KOOTA-PERF-03 | 値schemaのcodec/projectionを正式に接続する               | Vector経路の重複処理を減らせる可能性       | Trait内部get/set差替え・Query wrapperを減らせる | 中。schema/Asset意味論はnekoへ残す                |
| KOOTA-PERF-04 | Queryとselected Systemの読出し・変更判定・書戻しを共通化 | per-Entity準備費用を狙えるが不確実         | 二系統の更新処理を一本化できる可能性            | 中〜大。通知・再入・例外契約を維持する必要        |
| KOOTA-PERF-05 | Query集合のversion/差分を使い、matchの全件照合を減らす   | 静的な集合の更新で期待。変更が多い場合は別 | 毎phaseのSet生成や再照合を減らせる可能性        | 公開onQueryAdd/Removeでも試せる。fork必須ではない |
| KOOTA-PERF-06 | Entity削除通知とlifetime接続を明示する                   | 破棄時の間接処理を減らせる可能性           | 空Queryによる削除検出の代用を解消できる         | 中。Relation連鎖・通知順・再入の確認が必要        |
| KOOTA-PERF-07 | 診断・projection情報の正式API                            | 性能目的では優先しない                     | $internal参照と一部型castを減らす               | 小。安定した読取APIに限定可能                     |

既存PrefabのInactive TagをECSのEntity enabledへ置き換える候補は、[有効化Audit](../../../../../../neko-threejs/docs/Development/Discussion/Prefab/feature-control/2026-09-06_open-questions.md)のKOOTA-FORK-01で追跡し、ここへ重複登録しない。Entity APIをclassへ全面変更する案も別の設計変更で、今回の速度改善の前提にしない。

## 1. Queryのcopy：最初に比較したい具体的な問題

導入版はSparseSet.dense自体が配列copyを返すのに、runQueryでさらにsliceする。さらにcommitQueryRemovalsは各反復でdenseを読み直し、縮小する除外集合を繰返しcopyする。

[コピー回数の確認](../../../Performance/Query/query-copy/2026-09-06_query-copy-inspection.md)では、1,000体の通常Queryで2,000要素、1,000体を除外した後の反映で501,500要素のcopyがあった。後者の要素コピー量は除外件数に対して二次的に増える。計数は実行したが実時間の改善率は未測定。

- 通常Queryは独立した結果配列を一回作ればよい候補。内部集合の生配列をそのまま返す変更にはしない。
- 除外反映は一回取得したsnapshotを走査する候補。内部の削除時処理に再入がないことと、再追加・複数Query・追跡条件を確認する。
- nekoのWorld.matchingEntitiesもQuery結果をspreadで再copyしている。その一枚を除く案はforkなしで比較できる。ただしcallback中の集合変更に対する順序と対象を維持する。

上流v0.6.6の[Query](https://github.com/pmndrs/koota/blob/v0.6.6/packages/core/src/query/query.ts)と[SparseSet](https://github.com/pmndrs/koota/blob/v0.6.6/packages/collections/src/sparse-set.ts)、導入bundleを照合した。この変更だけで長期的な独自ECSを持つ必要があるとは結論しない。

## 2. fromの結果を正規のQuery resultとして絞る

現行のEcsQuery.executeはKootaでTrait候補を取得し、PrefabMembershipのpredicateで結果配列を詰める。KootaAdapter.filterResultはreadonly配列をmutableへcastし、lengthを書き換える。readEach/updateEach/useStoresが同じ配列を閉包参照することへ依存している。

fork側が正式なfilter結果や候補Entity列を受ける入口を持てれば、nekoは所属predicateだけを渡せる。CSS解析・Prefab所有関係・Asset元定義のidentityはnekoに残す。KootaへPrefab名やScene概念を移さない。

速度が上がるのは二重の結果生成や走査を融合できた場合。単に現在のloopを別fileへ移すだけならコードの境界改善として評価する。[既存selector測定](../../../../../../neko-threejs/docs/Development/Performance/Query/prefab-selection/2026-09-06_prefab-selection-v1.md)では、定義だけのfromは手動Tagと同程度であり、全fromを高価な汎用predicateへ置き換えない。

## 3. Vector・objectのschemaとQuery更新の接続

現行の経路には次の層がある。

```text
nekoの構造化schema
→ Kootaのflat列Trait
→ 差し替えたget/setで入力・snapshotを変換
→ KootaのQueryがrecordを取得
→ nekoがborrowed draftへ一時的に入れ替える
→ callback
→ 元のrecordへ戻す
→ Kootaが比較・書戻し
```

根拠はsrc/ecs/trait.ts、HEADのsrc/ecs/query.tsとsrc/ecs/koota-adapter.ts、src/ecs/draft.ts、Kootaのquery-result。公開getの構造化propertyを追加した後、updateEachで別の借用projectionへ接続する経路がある。selected Systemではadapterで装飾前のflat copyを読む迂回路もある。

候補はKootaのTrait／Query計画にcodec・snapshot・更新projectionの正式な接続点を置くこと。nekoのvector/objectのschema意味論、props/Assetへの定義共有は維持し、ECSにゲーム固有schemaをハードコードしない。scalarには現在の軽い経路を残し、全Traitを一律のgetter/setterへ変換しない。

[活動追加時の直近Vector測定](../../../../../../neko-threejs/docs/Development/Performance/Prefab/activation/2026-09-06_prefab-activation-v1.md)では5,000体countのlocalがscalar6.651ms/vector21.561ms、bulkが0.293ms/8.604ms。これは改善余地を探す根拠であり、codecやKootaだけが原因だとは証明していない。

[過去の直接SoA実験](../../../../../../neko-threejs/docs/Development/Performance/Query/direct-soa/2026-09-05_direct-soa-experiment-v1.md)ではscalar bulkが0.54→7.84ms、Prefabが5.86→10.77msへ悪化し見送った。[後続実験](../../../../../../neko-threejs/docs/Development/Performance/Runtime/update-cost/2026-09-05_runtime-followup-experiments-v1.md)でもlease管理へ変えて回帰を解消できなかった。再実験は「Koota内だから速い」ではなく、どの配列・view・照合を新たに省けるかを先に示す。借用失効・有限値検査・同期再入を消して速度だけ比較しない。

## 4. selected SystemとQueryの更新kernel

SystemAttachmentはTrait列の読出し、比較用copy、借用、書戻し、changed通知を独自実装し、KootaのupdateEachも類似の処理を持つ。Systemのcontext、alias、所有・実行順はnekoへ残し、データの編集と通知に必要な部分を一つのkernelへ接続できる余地がある。

ただし現行は通知のタイミングが完全には同じではない。KootaのupdateEachはchangedPairsをloop後に通知し、selected Systemは一体分の書戻し後に通知する。何も考えず一括kernelへ載せると、Eventから観測する値と順序が変わる。失敗時の書戻し・AoSの参照・callback内remove/addも含め、共通化できる範囲を限定する。

再利用可能な編集bufferを入れるだけの案は過去に悪化している。変更量が最も大きい候補なので、codec接続の小さい比較を先に行う。

## 5. matchの再照合とTransformの準備

SystemAttachment.syncMatchesは毎回new Set(entities)を作り、既存matchの失効と新規matchを照合する。Kootaには既にonQueryAdd/onQueryRemoveがあり、内部Queryにもversionがある。変更のない集合では差分処理にできる可能性がある。

まず公開通知でどこまで可能かを比較する。forkするなら安定した集合version／差分cursorの読取を追加する候補。通知のたびに即awake/disposeするのではなく、現在のphase境界へ反映し、生成・除去・再追加の順序を維持する。activityの停止とTrait不一致も区別する。

TransformもstageMembershipで全Entityを確認し、値を使わないreadEachでrecordを取得する。Entityだけを列挙する改善は現行Queryでも可能で、fork不要。集合・Relationのversionによる拓撲再構築抑制は後続候補だが、useStores経由の直接変更をChangedだけで検知できるとは仮定しない。

## 6. Entity破棄とcleanup

EntityLifecycleは空QueryのonQueryRemoveを利用し、外部／Relation連鎖によるEntity破棄をScopeのcleanupへ接続している。終了pending集合・Scope・世代を管理する理由がある。Kootaに削除の確定を通知する正式なhookがあれば、「Queryから外れた」という通知を「Entityが削除された」検出に使う間接性を減らせる。

KootaのdestroyEntityは内部queueとRelation削除を扱うため、callbackを自由な地点で呼ぶだけでは再入問題を作る。安全な通知点と外側cleanupのflushを維持し、scope/bindings全削除を目標にしない。性能は大量破棄で比較し、最初にQuery除外copyの費用を解消してから残りを評価する。

## 7. 内部依存と型境界

HEADのKootaAdapterはentityTraitsの列挙、Trait codecの差替え、装飾前の列読出し、Query parameterからのprojection Trait抽出を担当する。正式なAPIがあれば$internal依存や一部castを減らせる。診断のためにmutableな内部Setを公開せず、コピーまたは読取iteratorで範囲を限定する。

ただしsrc/ecs.tsの型には、managed Entityから直接destroyを外すこと、schema input/snapshot/draftを区別すること、Relationにmanaged Entityを渡すことなど、neko自身の契約も含まれる。Koota型を丸ごと再exportして全castを消すことを目標にしない。

## forkへ移しても本質的に改善しないもの

- Component依存の宣言・IDE補完とcallback-localなoperationの失効。ECSの列管理ではなくnekoのAPI契約の費用。
- Prefabの親子・生成順・count・props・Assetの組立て。ECSへ移しただけでは処理が消えない。
- ActivityOwnerのresource休止、InputのScene別受付、TimelineやRenderの停止動作。Kootaの有効bitだけでは機能ごとの意味を実装できない。
- callback一回ごとの独立したborrowed lifetime。古いviewを再利用して復活させる最適化は不可。
- 数値Entityをclassへ変更すること。補完やメソッド追加の自由は得られるが、allocation・identity・packed IDへの影響があり、性能改善を仮定しない。

## 推薦する評価順

1. KOOTA-PERF-01の二種類のcopy除去を別々に計測する。通常Queryと大量除外・disable・dispose、結果順と追跡Queryを確認。
2. KOOTA-PERF-02と07で、fromの結果加工・診断の内部依存を小さな正式APIへ置き換えられるか比較。
3. KOOTA-PERF-03のcodec接続を、scalar fast pathを固定してVector中心に比較。既存VECTOR-PERF-01の原因切分けと連携する。
4. 04/05/06はscope・通知・順序への影響が大きいので個別に評価。全て一度にforkへ入れない。

採用基準は性能改善、または性能同等で全体のコードが理解しやすくなること。neko側の削除行数だけでなくfork側の追加コード、公開拡張点の数、維持するテストと上流差分も数える。候補一覧は実装の一括承認ではない。
