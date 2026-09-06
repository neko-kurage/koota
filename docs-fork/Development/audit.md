# 残作業

## 次に進める順番

1. Prefab/entity-activation：元の目的であるEntity有効化について、利用側の必要契約を受けてKootaに置く最小範囲を決める。設計が閉じる前にTrait別切替まで広げない。
2. 独立したfeatureで契約・未使用時・更新・切替時の費用を比較する。既存の七候補をやり直す必要はない。
3. Koota/branch-integrationとKoota/distribution：採用変更を統合・CI確認し、固定した配布物を用意する。今回の七候補だけを先に配布するか、有効化の変更を含めるかもそこで決める。

この一覧は実装・merge・push・publishの新たな実行承認ではない。設計・配布の未決事項を確定してから進める。

## 残作業

| ID                | 作業                                      | 状態                   | 次に決める・確認すること                                                                                                                          |
| ----------------- | ----------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prefab/entity-activation    | Entity有効状態とQueryへの最小接続         | 候補（契約待ち）       | Entity操作の入口、値保持、Query一致・通知、世代再利用、休止/再開の費用。Prefab親子やComponent休止はKootaへ持ち込まない                            |
| [Koota/branch-integration](Discussion/Koota/branch-integration/2026-09-06_scope.md) | 検証済みfeatureの統合とremote反映         | 未着手                 | developへ反映する範囲を決め、明示branchをpushしCI確認。既存ローカルverify成功をCI成功とみなさない                                                 |
| Koota/distribution  | 不変な配布物の作成・公開方法              | 候補（配布方式未確定） | package名/alias、配布先、独自version、source revision・integrityの対応を決める。公式0.6.6を上書きしない                                           |
| Entity/reentrant-destroy      | destroy通知への再入でRelation連鎖が欠ける | 候補                   | 親のremove購読で別Entityをdestroyすると子が残る。共有queue/set、通知順・重複・連鎖を保つ修正を別件で検討。利用側の遅延cleanupを現行バグ扱いしない |

Entity有効化は今回の性能候補とは別件。再入症状の根拠は[削除hookの実験](Performance/Runtime/performance-candidates/2026-09-06_rejected-candidates-v1.md#06-entity削除hookとcleanup)。初回配布と有効化の設計を混同しない。
