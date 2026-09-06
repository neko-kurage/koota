# Koota fork Audit：現在地と残作業

更新日：2026-09-06。確認したrevision：d434fa4、branch：feature/performance-candidates。Kootaの現在状態・全残作業・採否はこのページだけで管理する。nekoの公開API設計と依存更新の作業状態はneko側で管理し、こちらへ転記しない。

## 現在地

初回の七候補は評価済み。Query copy削減・結果絞込みAPI・診断APIを採用し、d434fa4でコミット済み。コメント規則とBetter Todo Tree設定は24df52c。Kootaの実装差分に未コミット作業はなく、今回のAudit整理だけが未コミット。

developは環境整備dd1f53d、mainは基準v0.6.6（7d1329a）。採用実装はまだdevelop/mainへ統合していない。今回のfeatureのpush・CI実行・package公開は未実施。配布先と独自versionも未確定。ローカル検証用koota-0.6.6.tgzは公開用releaseではない。

## 次に進める順番

1. FORK-ACTIVE-01：元の目的であるEntity有効化について、利用側の必要契約を受けてKootaに置く最小範囲を決める。設計が閉じる前にTrait別切替まで広げない。
2. 独立したfeatureで契約・未使用時・更新・切替時の費用を比較する。既存の七候補をやり直す必要はない。
3. FORK-INTEGRATE-01とFORK-DELIVERY-01：採用変更を統合・CI確認し、固定した配布物を用意する。今回の七候補だけを先に配布するか、有効化の変更を含めるかもそこで決める。

この一覧は実装・merge・push・publishの新たな実行承認ではない。設計・配布の未決事項を確定してから進める。

## 残作業

| ID                | 作業                                      | 状態                   | 次に決める・確認すること                                                                                                                          |
| ----------------- | ----------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| FORK-ACTIVE-01    | Entity有効状態とQueryへの最小接続         | 候補（契約待ち）       | Entity操作の入口、値保持、Query一致・通知、世代再利用、休止/再開の費用。Prefab親子やComponent休止はKootaへ持ち込まない                            |
| FORK-INTEGRATE-01 | 検証済みfeatureの統合とremote反映         | 未着手                 | developへ反映する範囲を決め、明示branchをpushしCI確認。既存ローカルverify成功をCI成功とみなさない                                                 |
| FORK-DELIVERY-01  | 不変な配布物の作成・公開方法              | 候補（配布方式未確定） | package名/alias、配布先、独自version、source revision・integrityの対応を決める。公式0.6.6を上書きしない                                           |
| KOOTA-BUG-01      | destroy通知への再入でRelation連鎖が欠ける | 候補                   | 親のremove購読で別Entityをdestroyすると子が残る。共有queue/set、通知順・重複・連鎖を保つ修正を別件で検討。利用側の遅延cleanupを現行バグ扱いしない |

Entity有効化は今回の性能候補とは別件。再入症状の根拠は[削除hookの実験](../../../Performance/Runtime/performance-candidates/2026-09-06_rejected-candidates-v1.md#06-entity削除hookとcleanup)。初回配布と有効化の設計を混同しない。

## 七候補の採否：評価完了

| ID            | 対象                         | 結果               | 再開・維持の条件                                                                |
| ------------- | ---------------------------- | ------------------ | ------------------------------------------------------------------------------- |
| KOOTA-PERF-01 | 通常Queryと除外反映のcopy    | 完了・採用         | snapshot・除外取消しを維持し、二変更を個別測定。上流更新時も構造と性能を確認    |
| KOOTA-PERF-02 | Query結果の正式な絞込み      | 完了・採用         | retainQueryResultで配列identity・helper・型を維持。常時closureを追加しない      |
| KOOTA-PERF-03 | codecとprojectionの接続      | 見送り             | safeなraw読取でscalar/vectorが回帰。guardと不要装飾を両立して減らす具体案が必要 |
| KOOTA-PERF-04 | Query/selectedの更新処理共有 | 見送り             | 通知時点・例外・比較基準が異なる。契約を維持して省ける処理を示すこと            |
| KOOTA-PERF-05 | Query集合のversion/差分API   | 見送り             | 公開通知で試作可能。利用側の同期改善はKoota追加APIの未完了作業にしない          |
| KOOTA-PERF-06 | Entity削除hookへの置換       | 見送り             | 除外時Scope終了・通知順・再入が変わる。単純hookへ置き換えない                   |
| KOOTA-PERF-07 | 診断・projection読取API      | 完了・診断のみ採用 | getEntityTraitsを追加。列projectionは追加しない                                 |

[全体の測定](../../../Performance/Runtime/performance-candidates/2026-09-06_candidate-evaluation-v1.md)、[見送りの根拠](../../../Performance/Runtime/performance-candidates/2026-09-06_rejected-candidates-v1.md)、[再現fixture](../../../../../benches/fork/candidate-repros/README.md)。見送りを未着手として再登録せず、新しい根拠がある場合だけ再開する。

## 完了した準備と検証

| ID・範囲           | 確認結果                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------- |
| FORK-ENV-01        | 固定Node/pnpm、上流build、verify入口、baseline worktreeを準備。dd1f53dに収録                                  |
| FORK-REMOTE-01     | 公開fork・SSH origin・main/develop/featureのremoteを登録。初期接続は完了、今回のfeature pushは上の残作業      |
| FORK-DOCS-01/02    | docs-forkへ独自資料を分離。環境資料はdd1f53dでコミット済み                                                    |
| 独自コメント・目印 | 日本語コメント、FORKとAudit ID、Better Todo Treeの4箇所検出を確認。24df52cとd434fa4に収録                     |
| 七候補の最終検証   | source 201・配布用178、型・build・pack。利用側の独立checkoutは470テストを含むverify成功。ABBA・from追試も実施 |

上記は検証したrevisionと範囲の記録であり、未公開packageの導入完了や未実装Entity有効化の保証ではない。

## 詳細と履歴

[作業手順](../../../fork-workflow.md)、[受入方針](../../../fork-maintenance-policy.md)、[Audit運用](2026-09-06_previous-audit-workflow.md)、[初回の環境・実験の記録](../../Runtime/performance-candidates/2026-09-06_initial-fork-audit-history.md)。過去の未コミットや次の作業の記述はHistoryへ移し、現在の判断はこのページで完結させる。

今回の整理は文書のみ。候補の実装、branch統合、push、公開は実施しない。文書のlocal Markdown target・fragmentとgit diff --checkを確認済み。runtimeテスト・性能測定は再実行していない。未コミット。
