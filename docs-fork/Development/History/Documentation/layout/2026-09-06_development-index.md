# neko向けKoota forkの開発資料

独自資料は[docs-fork](../../../../00_index.md)に分離し、上流のdocsには置かない。Developmentはneko-threejsと同じ分類で、検討記録をHistory、測定をPerformanceに置く。

- [作業環境・Git手順](../../../fork-workflow.md)
- [上流追従・性能の受入方針](../../../fork-maintenance-policy.md)
- [開発原則](../../../development-rules.md)
- [Audit運用](2026-09-06_previous-audit-workflow.md)
- [現在地と残作業](../../../audit.md)：最初にここを読み、全残作業と次の順番を確認する
- [既存機能の改善候補](../../Runtime/performance-candidates/2026-09-06_existing-feature-candidates.md)
- [有効化APIの議論snapshot](../../../Discussion/Prefab/entity-activation/2026-09-06_execution-control-discussion.md)
- [七候補の個別実験・採否](../../../Performance/Runtime/performance-candidates/2026-09-06_candidate-evaluation-v1.md)
- [03〜06の契約再現と見送り理由](../../../Performance/Runtime/performance-candidates/2026-09-06_rejected-candidates-v1.md)
- [Queryコピー回数の測定と再確認コード](../../../Performance/Query/query-copy/2026-09-06_query-copy-inspection.md)

移管元は隣接neko-threejsのdocs。利用側の過去測定やAPI議論への相対リンクは両repositoryを同じ親directoryへcloneした配置を前提とする。GitHubの未確認URLへ置き換えない。現在の作業状態とコミット状況はAuditで確認する。

- [初回の環境・実験のAudit記録](../../Runtime/performance-candidates/2026-09-06_initial-fork-audit-history.md)：過去の状態・検証とコミットの経緯。
