# Koota fork Audit

基準: v0.6.6 (7d1329aa82e313e715f6b7afbb8350e028c313b5)。2026-09-06。

| ID             | 作業                | 状態 | 根拠・次の作業                                                                                                                |
| -------------- | ------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------- |
| FORK-ENV-01    | Git・依存・検証環境 | 完了 | clone・branch・Git設定・baseline worktree・固定依存・verify入口を準備。型、source 196 tests、配布物173 tests、build、pack成功 |
| FORK-REMOTE-01 | GitHub forkとorigin | 完了 | 公開fork neko-kurage/kootaを作成。SSH origin接続、main・develop・feature/fork-environmentのpush完了。環境ファイルは未コミット |

手順は[fork開発環境](fork-workflow.md)。source変更・依存切替・性能改善の採用は未実施。

## 環境構築の検証結果

Node 24.4.0 / pnpm 10.32.0、frozen-lockfile install成功。core 136、collections 23、react 37 tests成功。配布用173 tests成功。verifyのpack出力先を絶対パスへ修正し、packを再実行して.artifactsへの出力を確認した。追加scriptの構文・lint、変更文書のformatとgit diff --checkを確認。

生成packageのdist/chunk-ZWIGMIL4.js、index.js、index.cjs、index.d.tsはnekoに導入済みの0.6.6とbyte一致。時間比較は未実施。成果物SHA256: 13c511ac2527645725e7c1169e7ebd727968b1cc5170bce4e35c931e72beba08。

GitHub fork・origin接続・branch登録は完了。環境ファイルと移管資料は未コミット、GitHub Actionsは未実行。次は差分の確認とコミット。その後、個別の実験を承認された範囲で開始する。

## branch構成の変更

ユーザー指定に合わせmain（安定版）、develop（開発統合）、feature/\*（個別作業）へ統一。現在はfeature/fork-environment。既存mainは独自変更がなくupstream/mainと一致していたため、安定版の初期値をv0.6.6へ揃えた。公式最新commitはupstream/mainに保持。CI対象と手順も更新。runtime変更はなく、branchと差分の空白を確認済み。

2026-09-06追記：非公開repository作成は中断され未成立。その後ユーザーがpublicを許可し、正式な公開forkを作成した。ログイン待ちは解消。mainは新規fork作成時のSHAを指定したleaseでv0.6.6へ初期化し、公式最新はupstream/mainに保持。remoteの3 branchを確認。未コミットの環境ファイルはまだGitHubに含まれず、CIも未実行。

## 現行機能の改善候補

2026-09-06にnekoの性能AuditからIDと状態を維持して移管。旧FORK-PERF-01はKOOTA-PERF-01と重複していたため統合した。根拠は[調査資料](History/existing-feature-candidates.md)、測定は[Query copy](Performance/query-copy-inspection.md)。候補は実装承認ではない。Entity有効化APIとVECTOR-PERF-01は[neko側Audit](../../../neko-threejs/docs/Development/13-trait-participation-audit.md)と[性能Audit](../../../neko-threejs/docs/Development/08-runtime-performance-audit.md)で継続する。

| ID            | 候補                                   | 状態 | 次に確認すること                                                           |
| ------------- | -------------------------------------- | ---- | -------------------------------------------------------------------------- |
| KOOTA-PERF-01 | 通常Queryと除外反映の不要copy除去      | 候補 | 二変更を個別に比較。Query・大量除外・disable/dispose・追跡条件・順序を検証 |
| KOOTA-PERF-02 | Query結果の正式な絞込みAPI             | 候補 | fromのreadonly配列加工を解消し、helperの対象一致・未使用費用を確認         |
| KOOTA-PERF-03 | schema codecと更新projectionの正式接続 | 候補 | VECTOR-PERF-01と連携し重複変換を切り分ける。scalarと借用契約を維持         |
| KOOTA-PERF-04 | selected SystemとQueryの更新kernel共有 | 候補 | 通知時点・例外・再入を変えず共有できる範囲と費用を比較                     |
| KOOTA-PERF-05 | Query集合のversion/差分を使うmatch同期 | 候補 | 公開onQuery通知での対案を先に評価。静的集合と頻繁な変更を比較              |
| KOOTA-PERF-06 | Entity削除通知とlifetimeの接続         | 候補 | Relation連鎖・削除確定点・cleanup再入を維持し間接性を減らせるか確認        |
| KOOTA-PERF-07 | 診断・projection情報の正式な読取API    | 候補 | 内部依存を減らし、fork側の追加を含め全体のコードを評価                     |

## 文書移管

FORK-DOCS-01：完了。運用方針・改善候補・copy測定を正本として移管。有効化の議論は参考snapshot、Audit運用とテスト・runtime原則はKoota向けに適用。develop-forkは設けず、上流更新もfeature/\*からdevelopへ統合。移管資料と元入口のlocal target・fragment計60件、変更文書のformat、両repositoryのgit diff --checkを確認。文書のみの変更なのでruntimeテスト・性能測定は再実行していない。次は未コミットの環境・資料差分のreview。

## 独自docsの分離

FORK-DOCS-02：完了。ユーザー指定により独自資料をdocs-forkへ移し、neko-threejsと同じ分類・History/Performanceの配置に統一。上流docsは維持。AGENTSとneko側の参照も更新。local target・fragment 74件、書式と両repositoryの空白を確認。上流docsの追跡差分がなく、旧docs/Developmentも残っていないことを確認。文書のみの変更でruntime検証は再実行していない。未コミット。

## 今回のコミット範囲

ユーザー依頼により、環境整備・verify入口・CI・docs-forkを今回のコミットに含める。過去の「未コミット」は各作業時点の記録。sourceとlockfileの変更、性能候補の実装は含めない。型・source 196件・配布用173件・build・packの既存成功結果と、最終文書リンク・空白確認を根拠とする。GitHub Actionsは未実行で、pushは別途行う。次は個別実験の対象決定。
