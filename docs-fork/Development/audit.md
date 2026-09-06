# 残作業

## 次に進める順番

1. Query/initial-population：削除後に初めて作る空Queryへ死んだEntityが入る再現を確認し、初期集合生成を調べる。
2. Koota/branch-integration：採用判断後にfeatureを統合し、明示branchのremote反映とCI確認を行う。
3. Koota/distribution：neko用の固定tgz検証は実施した。source commitは確定済み。正式release version・公開先を決定する。公開済みversionを上書きしない。

merge・push・publishの承認を兼ねない。

## 残作業

| ID                | 作業                                      | 状態                   | 次に決める・確認すること                                                                                                                          |
| ----------------- | ----------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Koota/branch-integration](Discussion/Koota/branch-integration/2026-09-06_scope.md) | 検証済みfeatureの統合とremote反映         | 未着手                 | developへ反映する範囲を決め、明示branchをpushしCI確認。既存ローカルverify成功をCI成功とみなさない                                                 |
| Koota/distribution  | 不変な配布物の作成・公開方法              | 候補（配布方式未確定） | 削除再入修正を含む配布物を固定しnekoへ導入する。公開先・version・revision/integrityの対応を決める。公式0.6.6を上書きしない                                           |
| [Query/initial-population](Discussion/Query/initial-population/2026-09-06-scope.md) | 削除後の初回Queryに破棄済みEntityが混入 | 候補（再現済み） | 初期集合と生存index範囲を確認。neko側への影響は未評価 |

Entity有効化は今回の性能候補とは別件。再入症状の根拠は[削除hookの実験](Performance/Runtime/performance-candidates/2026-09-06_rejected-candidates-v1.md#06-entity削除hookとcleanup)。初回配布と有効化の設計を混同しない。
