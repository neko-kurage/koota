# 文書配置の移行記録

2026-09-06。本文の要約・言い換えは行わず、配置・分割・参照を変更する。日付は本文の最初の日付、本文にない場合はGitの最終記録日を採った。新しい測定日を意味しない。

## 作業IDの対応

| 旧ID | 作業ID・項目ディレクトリ |
| --- | --- |
| FORK-ACTIVE-01 | Prefab/entity-activation |
| FORK-INTEGRATE-01 | Koota/branch-integration |
| FORK-DELIVERY-01 | Koota/distribution |
| KOOTA-BUG-01 | Entity/reentrant-destroy |

## ファイルの対応

| 旧配置 | 移動先 |
| --- | --- |
| `docs-fork/Development/fork-audit.md` | [docs-fork/Development/audit.md](../../../audit.md) |
| `docs-fork/Development/index.md` | [docs-fork/Development/00_index.md](../../../00_index.md) |
| `docs-fork/index.md` | [docs-fork/00_index.md](../../../../00_index.md) |
| `docs-fork/Development/History/execution-control-discussion.md` | [docs-fork/Development/Discussion/Prefab/entity-activation/2026-09-06_execution-control-discussion.md](../../../Discussion/Prefab/entity-activation/2026-09-06_execution-control-discussion.md) |
| `docs-fork/Development/History/existing-feature-candidates.md` | [docs-fork/Development/History/Runtime/performance-candidates/2026-09-06_existing-feature-candidates.md](../../Runtime/performance-candidates/2026-09-06_existing-feature-candidates.md) |
| `docs-fork/Development/History/initial-fork-audit-history.md` | [docs-fork/Development/History/Runtime/performance-candidates/2026-09-06_initial-fork-audit-history.md](../../Runtime/performance-candidates/2026-09-06_initial-fork-audit-history.md) |
| `docs-fork/Development/History/neko-integration.patch` | [docs-fork/Development/History/Koota/fork-integration/2026-09-06_neko-integration.patch](../../Koota/fork-integration/2026-09-06_neko-integration.patch) |
| `docs-fork/Development/Performance/candidate-evaluation-v1.md` | [docs-fork/Development/Performance/Runtime/performance-candidates/2026-09-06_candidate-evaluation-v1.md](../../../Performance/Runtime/performance-candidates/2026-09-06_candidate-evaluation-v1.md) |
| `docs-fork/Development/Performance/rejected-candidates-v1.md` | [docs-fork/Development/Performance/Runtime/performance-candidates/2026-09-06_rejected-candidates-v1.md](../../../Performance/Runtime/performance-candidates/2026-09-06_rejected-candidates-v1.md) |
| `docs-fork/Development/Performance/query-copy-inspection.md` | [docs-fork/Development/Performance/Query/query-copy/2026-09-06_query-copy-inspection.md](../../../Performance/Query/query-copy/2026-09-06_query-copy-inspection.md) |
| `docs-fork/Development/audit-workflow.md` | [docs-fork/Development/History/Documentation/layout/2026-09-06_previous-audit-workflow.md](2026-09-06_previous-audit-workflow.md) |

## 分割と管理情報の追加

- 旧索引・旧Audit・旧管理規則はHistory/Documentation/layoutに本文を保持した。新索引とdocumentation.md、Discussion冒頭の状態表示は今回の合意に基づく管理情報。
- 元の本文中の過去の「現在」「未実装」「未コミット」は書き換えていない。現在の残作業はaudit.md、完成契約はArchitecture・API・Guidesから読む。

## 検証と引き渡し

docs-forkとAGENTSのlocal Markdown target・fragmentを検査し、変更範囲のリンク切れはなし。上流READMEの既存fragment #modifying-trait-stores-direclty は不一致のまま保持した。上流本文は変更していない。

移動前の各非空行が移動後の資料に残ることを照合し、リンク先・パス・IDの対応を除く本文の欠落は0件。表とコード例も照合対象。git diff --check成功。runtime実装は変更せず、runtimeテスト・性能測定は再実行していない。ユーザーの依頼により、本記録と文書整理を同じコミットへ収録する。
