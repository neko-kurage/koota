# Koota既存機能候補の個別評価 v1

2026-09-06。Koota v0.6.6 (`7d1329aa82e313e715f6b7afbb8350e028c313b5`)、環境整備 `dd1f53d` からのfeature/performance-candidates差分。nekoは `19f99b8` の独立checkout。保留中のTraitParticipationは含めない。各候補を分離して通常の上流build成果物を比較した。03は採用候補から撤回し、最終成果物は01・02・07だけを含む。

## 採否

| ID  | 判断             | 根拠                                                                                                                    |
| --- | ---------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 01  | 採用             | 二重copyと除外反映の反復copyをそれぞれ削減。snapshotと反映順を維持                                                      |
| 02  | 採用             | retainQueryResultへ結果加工の責任を集約。通常Queryへ新しいclosureを足さず、helper・型・対象を維持。速度向上は主張しない |
| 03  | 見送り           | 安全な公開raw読取を含む実案でscalar/vectorとも時間回帰                                                                  |
| 04  | 見送り           | 通知・例外・比較基準が異なる。現行契約を維持する最小共有案では整理利益を示せない                                        |
| 05  | fork APIは見送り | 公開通知で試作可能。nekoの別候補MATCH-SYNC-01へ記録。本体へ未採用                                                       |
| 06  | 見送り           | 削除hookだけでは除外時のScope終了、通知順、再入を代替できない                                                           |
| 07  | 診断APIだけ採用  | getEntityTraitsで内部Setへの型変換依存を解消。列読取・projection APIは追加しない                                        |

03〜06の実測・実行再現と再開条件は[個別レポート](2026-09-06_rejected-candidates-v1.md)。状態の正本は[Audit](../../../audit.md)。採用差分と本資料は同じコミットへ収録。公開・neko依存切替は未実施。

## 単体測定の条件

Node 24.4.0 / pnpm 10.32.0 / macOS arm64。同一端末で他のbuild・性能計測を停止し、別processでA/B順を交互に各5run。以下は各run p50/p99・GC合計・allocation推定の中央値。各行の基準は直前に採用した差分までを含み、対象変更だけを追加する。

5000体、6 scalar列。warmup50、100sample、一sample10反復の平均ms（除外反映のみ1000体・一反復）。p99はフレーム全体ではなく、このsampleの分布。GCは時間区間にPerformanceObserverで観測した総停止ms、allocationは別区間の100操作をinspector samplingInterval=1024・回収済sample込みで推定したbytes。生存heapだけをallocationとみなさず、profile.samplesのsizeを集計した。推定値には揺れがあり、GC回数だけで良否を判断しない。

除外反映は全体へTraitを再付与・Query反映・全除去してから測る。CPU時間はその後のQueryだけ、allocationとGCはこの準備処理も含む。通常Queryやscalar更新の値と直接足さない。診断は全EntityのTrait一覧取得、filterは偶数IDを残す操作を含む。queryは結果取得、scalarはupdateEachで同じ6数値を更新する。

| 比較 | 経路        | 基準 p50 / p99 (ms) | 候補 p50 / p99 (ms) | allocation 基準→候補 (MiB/100操作) | GC 基準→候補 (ms) |
| ---- | ----------- | ------------------- | ------------------- | ---------------------------------- | ----------------- |
| 01a  | query       | 0.001617 / 0.010429 | 0.000717 / 0.003946 | 7.765 → 3.941                      | 0.989 → 0.536     |
| 01a  | scalar      | 0.123117 / 0.237700 | 0.117429 / 0.128371 | 42.794 → 39.018                    | 3.934 → 3.843     |
| 01b  | remove      | 0.165917 / 0.587459 | 0.006625 / 0.018208 | 419.140 → 40.488                   | 6.512 → 0.888     |
| 01b  | query       | 0.000725 / 0.003450 | 0.000750 / 0.004492 | 3.932 → 3.960                      | 0.530 → 0.513     |
| 01b  | scalar      | 0.117475 / 0.226154 | 0.118021 / 0.134904 | 38.890 → 38.907                    | 3.875 → 3.977     |
| 02   | filter      | 0.006725 / 0.010033 | 0.006767 / 0.010813 | 3.950 → 3.949                      | 0.491 → 0.515     |
| 02   | query       | 0.000721 / 0.003433 | 0.000738 / 0.003688 | 3.952 → 3.953                      | 0.513 → 0.527     |
| 02   | scalar      | 0.117054 / 0.130829 | 0.117271 / 0.127687 | 39.015 → 38.884                    | 3.849 → 3.880     |
| 07   | diagnostics | 0.109246 / 0.163083 | 0.111433 / 0.124075 | 31.121 → 30.924                    | 3.408 → 3.409     |
| 07   | query       | 0.000708 / 0.005721 | 0.000717 / 0.006008 | 3.948 → 3.946                      | 0.499 → 0.494     |
| 07   | scalar      | 0.117446 / 0.137162 | 0.117183 / 0.129046 | 39.016 → 39.011                    | 3.914 → 3.867     |

01aの通常Queryはp50約56%・allocation約49%減、01bの大量除外反映はp50約96%減。これは対象の小さい区間の改善率で、Prefab全体の改善率ではない。02/07は同じ走査/lookupを正式APIに移し、常時経路に新しい実行処理を加えていない。短い区間の尾部や数%の中央値差を速度改善と主張しない。代表経路との比較も下記に分けて記録する。

### copy数の構造確認

Array.sliceを計数する別実行で確認。計数wrapperを時間測定には混ぜない。1000体。

| 状態    | 通常Query slice回数 / copy要素数 | 全除外反映 slice回数 / copy要素数 |
| ------- | -------------------------------- | --------------------------------- |
| v0.6.6  | 2 / 2000                         | 1003 / 501500                     |
| 01aのみ | 1 / 1000                         | 1002 / 501500                     |
| 01a+01b | 1 / 1000                         | 2 / 1000                          |

元の[計数コード](../../Query/query-copy/2026-09-06_query-copy-inspection.md#再確認コード)をそれぞれの配布物へ適用。SparseSet.denseの独立copyを残し、除外snapshotの取得回数だけを制限する。remove自身にcallbackはないため、逆順と再追加時の除外取消しを維持できる。

## 再現

[単体ベンチ](../../../../../benches/fork/candidate-cost.mjs)にbuild済み配布物の絶対パスとmodeを渡す。例:

```sh
node --expose-gc benches/fork/candidate-cost.mjs /absolute/baseline/dist/index.js query
node --expose-gc benches/fork/candidate-cost.mjs /absolute/candidate/dist/index.js query
COUNT=1000 node --expose-gc benches/fork/candidate-cost.mjs /absolute/candidate/dist/index.js remove
```

modeはquery/scalar/remove/filter/diagnostics。比較元のreadonly結果を加工する旧loop、旧内部診断はfixture内に残している。候補APIがある場合にそのAPIを使う。01aはquery.entities.denseの追加slice除去だけ、01bはtoRemove.denseの一回取得だけ、02はretainQueryResultとexport、07はgetEntityTraitsとexport。独立checkoutで各差分を通常buildし、必ず別processで比較する。

[neko接続差分](../../../History/Koota/fork-integration/2026-09-06_neko-integration.patch)は19f99b8向け。実際の依存切替では固定した配布version/integrityとsource SHAを決め、同じprocessに複数Kootaを入れない。今回の検証は独立checkoutのnode_modulesにbuild済みdistを入れ、元checkoutの依存とlockfileは変更していない。

## 診断の呼出境界の追試

上の最初のdiagnostics fixtureは旧処理だけをloopへinline展開していた。nekoの現行はstatic methodなので、両方を同じ関数呼出しに揃えて追試した。採用接続もWorldからgetEntityTraitsを直接呼び、adapterの委譲methodを残さない。500sample・各20反復、他の条件は同じ、各5process。

| 経路            | p50 (ms) | p99 (ms) | allocation (MiB/100操作) | GC (ms/時間区間) |
| --------------- | -------: | -------: | -----------------------: | ---------------: |
| 現行adapter相当 | 0.107408 | 0.118383 |                   30.983 |           17.240 |
| 正式API         | 0.106577 | 0.113031 |                   31.015 |           16.862 |

現行と同じlookup+snapshotで、意味と費用を維持しながらinternal SetをAPI内に閉じ込める。初回のinline対関数の差を一般的な無劣化の根拠にはせず、実利用の呼出境界を揃えた比較を採用根拠とする。再現fixtureもこちらの呼出境界へ修正済み。

## nekoの代表経路

既存runtime-cost/v2を無変更で実行。5000 Entityのscalar/vector/component、Koota直接・Project一括・count付きPrefab・一体ずつのPrefab。countは一つのPrefabに5000 Entity、個別は5000 Prefabであり、GPUの5000instanceを一Entityに所有させる例とは異なる。

基準A→候補B→候補B→基準Aの4process。各processはwarmup40・120frameを3round（round2はcase順反転）、allocationは別の40frameを回収済sample込みsamplingInterval32768で測る。各fixtureの演算checksumと通知数は全て成功。表は二processの結果の範囲で、異なるprocessのp50/p99を混ぜた疑似percentileを作らない。時間ms、allocation MiB/frame。

| 形 / 経路                 | 基準 p50範囲  | 候補 p50範囲  | 基準 p99範囲  | 候補 p99範囲  | allocation 基準範囲 → 候補範囲 |
| ------------------------- | ------------- | ------------- | ------------- | ------------- | ------------------------------ |
| scalar / koota            | 0.597–0.608   | 0.607–0.612   | 1.838–2.020   | 1.938–1.939   | 1.699–1.700 → 1.619–1.661      |
| scalar / project-bulk     | 0.644–0.671   | 0.660–0.666   | 1.953–2.291   | 1.916–1.949   | 1.792–1.851 → 1.793–1.811      |
| scalar / prefab-batch     | 6.174–6.434   | 6.185–6.294   | 15.538–27.769 | 12.327–12.902 | 17.542–17.629 → 17.715–17.788  |
| scalar / prefab-single    | 8.381–9.050   | 8.413–8.561   | 17.223–17.871 | 16.983–18.775 | 20.348–20.425 → 20.335–20.368  |
| vector / koota            | 0.580–0.605   | 0.566–0.568   | 2.033–2.055   | 2.020–2.045   | 1.585–1.729 → 1.651–1.687      |
| vector / project-bulk     | 9.277–9.444   | 9.212–9.224   | 15.518–17.493 | 15.864–16.518 | 18.429–18.444 → 18.258–18.554  |
| vector / prefab-batch     | 21.219–21.376 | 21.268–21.321 | 25.211–27.152 | 26.045–26.536 | 30.299–30.557 → 30.483–30.596  |
| vector / prefab-single    | 23.995–25.445 | 23.709–23.948 | 31.037–35.403 | 29.480–35.750 | 33.060–33.077 → 33.063–33.470  |
| component / koota         | 0.575–0.602   | 0.566–0.577   | 2.203–2.208   | 2.186–2.193   | 1.669–1.701 → 1.653–1.680      |
| component / project-bulk  | 1.192–1.207   | 1.138–1.157   | 3.028–3.486   | 2.941–2.985   | 1.709–1.898 → 1.806–1.808      |
| component / prefab-batch  | 14.532–15.173 | 13.430–14.560 | 22.062–22.200 | 22.375–22.654 | 28.953–29.078 → 28.842–29.085  |
| component / prefab-single | 17.876–18.862 | 17.990–18.065 | 24.230–28.544 | 25.853–26.874 | 31.128–31.860 → 31.551–31.868  |

GC・保持heap・生成破棄も同fixtureから取得。次表は二processのGC総停止範囲（各360frame合計）、保持heap範囲（MiB）。保持heapはGC後の差分でありallocationと区別する。

| 形 / 経路                 | GC 基準 → 候補 (ms)                   | 保持heap 基準 → 候補 (MiB)    |
| ------------------------- | ------------------------------------- | ----------------------------- |
| scalar / koota            | 17.493–20.655 → 20.983–22.736         | 1.117–1.126 → 1.117–1.117     |
| scalar / project-bulk     | 17.552–18.337 → 17.821–18.109         | 10.644–10.649 → 10.643–10.644 |
| scalar / prefab-batch     | 483.198–614.491 → 486.713–493.613     | 20.569–20.576 → 20.569–20.574 |
| scalar / prefab-single    | 514.918–599.944 → 513.289–530.817     | 43.484–43.484 → 43.474–43.485 |
| vector / koota            | 13.119–16.609 → 12.663–14.833         | 0.965–0.970 → 0.968–0.970     |
| vector / project-bulk     | 456.408–612.913 → 493.614–573.518     | 10.635–10.637 → 10.630–10.635 |
| vector / prefab-batch     | 649.374–750.901 → 657.040–673.973     | 20.544–20.580 → 20.545–20.550 |
| vector / prefab-single    | 746.000–852.249 → 714.053–769.351     | 43.464–43.511 → 43.456–43.523 |
| component / koota         | 15.873–17.368 → 15.226–16.157         | 0.933–0.963 → 0.930–0.958     |
| component / project-bulk  | 19.496–20.385 → 16.015–17.807         | 10.645–10.648 → 10.657–10.659 |
| component / prefab-batch  | 1008.011–1018.152 → 1019.222–1022.438 | 20.544–20.545 → 20.547–20.549 |
| component / prefab-single | 1000.123–1102.924 → 1002.802–1010.857 | 43.479–43.531 → 43.474–43.531 |

Query取得のcopy削減は全体の小部分であり、全Prefab経路の高速化とは結論しない。GCを含むtailは両方向へ揺れ、二processで不確実性が消えるものではない。生成/破棄のwarmup後2roundを各processから集めた範囲は次のとおり（ms）。初回のJIT費用と別に示す。

| 形 / 経路                 | 生成 基準 → 候補              | 破棄 基準 → 候補                  |
| ------------------------- | ----------------------------- | --------------------------------- |
| scalar / koota            | 1.845–1.957 → 1.973–3.618     | 3.436–3.895 → 3.593–4.115         |
| scalar / project-bulk     | 12.317–17.691 → 11.382–13.120 | 41.744–45.373 → 42.134–43.317     |
| scalar / prefab-batch     | 21.010–25.333 → 17.183–21.619 | 74.096–86.341 → 68.534–78.228     |
| scalar / prefab-single    | 47.469–61.517 → 44.505–57.435 | 111.180–126.989 → 118.340–138.920 |
| vector / koota            | 1.938–2.331 → 1.948–2.453     | 3.508–4.285 → 3.511–4.048         |
| vector / project-bulk     | 21.468–22.800 → 20.925–22.095 | 39.164–54.377 → 38.632–50.964     |
| vector / prefab-batch     | 25.016–32.873 → 25.367–31.236 | 71.692–78.748 → 72.085–77.499     |
| vector / prefab-single    | 58.199–63.885 → 58.351–61.164 | 123.223–132.008 → 118.680–130.588 |
| component / koota         | 1.918–2.216 → 1.881–3.632     | 3.610–4.049 → 3.466–4.666         |
| component / project-bulk  | 11.158–15.743 → 10.852–21.518 | 41.493–191.914 → 41.516–224.043   |
| component / prefab-batch  | 21.870–24.008 → 21.388–21.998 | 73.787–340.181 → 72.457–360.500   |
| component / prefab-single | 44.544–50.084 → 43.458–45.873 | 129.585–220.873 → 127.954–218.233 |

新APIを使わない更新処理には分岐・closure・購読を追加していないこと、01がsnapshotを減らすだけで新規allocationを増やさないこともsourceで確認した。小さい逆方向の値を性能劣化の許容枠として扱わず、差が再現する条件が見つかれば再調査する。今回確認した範囲では、03のような安定した時間回帰は確認していない。

```sh
RUNTIME_BENCH_FILTER='(scalar|vector|component)/5000/(koota|project-bulk|prefab-batch|prefab-single)' \
NEKO_BENCHMARK_SUITE=runtime-cost node_modules/.bin/vp test --run --disableConsoleIntercept \
  --config benchmarks/vite.config.ts benchmarks/runtime-cost/runtime-cost.benchmark.ts
```

最終の診断接続では、Worldから正式APIを直接呼ぶ。上記フレーム測定に診断の列挙は含まれず、診断は前節で独立比較した。

## fromと未使用経路の追試

既存prefab-selection/v1の一括更新側（unused cost and filtered bulk updates）を実行。count/個別・plain/tag/definition/child/instance/wildcardの12条件、各5trial。値の合計も全て一致した。最初のB→Aでplainのp50に約0.13〜0.25msの差が出たため、A→Bでも再測定。大きな差は再現せず、さらにwarmupを30から300へ増やし、期待する更新回数を130から400へ合わせた追試を行った。変更は検証checkout内だけで、測定後に元へ戻した。

以下はwarmup300の各5trial p50/p99の中央値、ms。初回の不安定な値を改善率には使わない。

| 経路                  | 基準 p50 / p99      | 候補 p50 / p99      |
| --------------------- | ------------------- | ------------------- |
| count/plain           | 0.224000 / 0.814042 | 0.220625 / 0.813542 |
| count/tag             | 0.138584 / 0.492583 | 0.131583 / 0.464500 |
| count/definition      | 0.123959 / 0.467917 | 0.121292 / 0.469500 |
| count/child           | 0.235792 / 0.572333 | 0.232500 / 0.551959 |
| count/instance        | 0.200000 / 0.534667 | 0.192709 / 0.537791 |
| count/wildcard        | 0.327541 / 0.654958 | 0.323542 / 0.663125 |
| individual/plain      | 0.225792 / 0.964250 | 0.222042 / 0.977291 |
| individual/tag        | 0.144292 / 0.517666 | 0.140791 / 0.526417 |
| individual/definition | 0.123750 / 0.507625 | 0.121959 / 0.514916 |
| individual/child      | 0.303291 / 0.738792 | 0.299167 / 0.738875 |
| individual/instance   | 0.071708 / 0.155583 | 0.069584 / 0.125167 |
| individual/wildcard   | 0.471875 / 0.875958 | 0.463208 / 0.869209 |

filter単体のallocation/GCは前節、from全体の保持heapは既存fixtureで取得。warmup300時のcountは基準約9MiB、個別は約29MiBで、Query取得後も同程度。処理量とQuery helperの対象は同じまま、結果加工の責任をKootaの正式APIへ移す02を採用する。from全体のallocation/GCを専用に分離して測るfixtureは追加していない。

```sh
NEKO_BENCHMARK_SUITE=prefab-system node_modules/.bin/vp test --run --disableConsoleIntercept \
  --config benchmarks/vite.config.ts benchmarks/prefab-system/selection.benchmark.ts -t 'unused cost'
```

## 最終検証と引き渡し

- Koota: node scripts/verify-fork.mjs成功。型、collections 23・core 141・react 37（source計201）、配布用178テスト、上流build、pack。配布用テストはsourceからの生成物で、独立に手書きした重複テストではない。
- neko 19f99b8の独立checkout: npm run verify成功。型・lint・format・文書sample、470テスト、architecture、core/assets/standard packと公開宣言、examples/editor build。初回は未buildのworkspace宣言とoptional native binding不足を解消してから再実行した。元repositoryに存在した同一version 1.2.3のdarwin-arm64 bindingを検証checkoutへ補充した。repositoryの依存指定・lockfileは変更していない。
- 診断の旧adapter互換テスト一件は、fork側の公開API契約テストへ移したため、neko接続差分では削除する。World診断の既存テストと他のcodec/projection互換テストは維持。
- エージェントによる最終sourceとsnapshot・通知・型・接続の独立レビューで、修正必須の指摘なし。
- 元neko checkoutの保留中sourceは維持。そこへの変更はMATCH-SYNC-01候補の台帳追記だけ。接続の実装差分はこの資料から辿れるpatchと独立checkoutに保存した。

配布先・独自versionの決定と、検証済み成果物へのnekoの依存固定は次の導入作業。feature差分を本資料とともにコミットし、main/developへのruntime統合・push・publishは行っていない。

検証したpack成果物SHA256: `52294593d4d3ed720faff8fcc0a5d9d4caa96719000d28f035daa9a35f3bf98d`。この0.6.6名のtarballはローカル検証用であり、同名の公式releaseへ上書き公開しない。
