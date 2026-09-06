# 初回fork整備と七候補のAudit記録

2026-09-06に現在状態を整理する前のsnapshot。以下の「現在」「未コミット」は当時の表現。[現在の作業](../../../audit.md)を正本とする。

基準: v0.6.6 (7d1329aa82e313e715f6b7afbb8350e028c313b5)。2026-09-06。

現在: feature/performance-candidatesで七候補を個別評価。01・02・07を残し、03・04・06と05のfork APIは見送り。型・source 201件・配布物178件・build・pack成功。nekoの独立checkoutでも470件のテスト・型・pack・examples/editor build成功。交互順性能比較・from追試まで完了。性能差分は本台帳更新と同じコミットへ収録。コメント規則・Better Todo Tree設定は24df52c。push・依存切替は未実施。正本は[今回の測定](../../../Performance/Runtime/performance-candidates/2026-09-06_candidate-evaluation-v1.md)。

| ID             | 作業                | 状態 | 根拠・次の作業                                                                                                                |
| -------------- | ------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------- |
| FORK-ENV-01    | Git・依存・検証環境 | 完了 | clone・branch・Git設定・baseline worktree・固定依存・verify入口を準備。型、source 196 tests、配布物173 tests、build、pack成功 |
| FORK-REMOTE-01 | GitHub forkとorigin | 完了 | 公開fork neko-kurage/kootaを作成。SSH origin接続、main・develop・feature/fork-environmentのpush完了。環境ファイルは未コミット |

手順は[fork開発環境](../../../fork-workflow.md)。以下の環境・移管節の状態は各作業時点の記録。最新のruntime作業状態は先頭と候補表を参照する。

## 環境構築の検証結果

Node 24.4.0 / pnpm 10.32.0、frozen-lockfile install成功。core 136、collections 23、react 37 tests成功。配布用173 tests成功。verifyのpack出力先を絶対パスへ修正し、packを再実行して.artifactsへの出力を確認した。追加scriptの構文・lint、変更文書のformatとgit diff --checkを確認。

生成packageのdist/chunk-ZWIGMIL4.js、index.js、index.cjs、index.d.tsはnekoに導入済みの0.6.6とbyte一致。時間比較は未実施。成果物SHA256: 13c511ac2527645725e7c1169e7ebd727968b1cc5170bce4e35c931e72beba08。

GitHub fork・origin接続・branch登録は完了。環境ファイルと移管資料は未コミット、GitHub Actionsは未実行。次は差分の確認とコミット。その後、個別の実験を承認された範囲で開始する。

## branch構成の変更

ユーザー指定に合わせmain（安定版）、develop（開発統合）、feature/\*（個別作業）へ統一。現在はfeature/fork-environment。既存mainは独自変更がなくupstream/mainと一致していたため、安定版の初期値をv0.6.6へ揃えた。公式最新commitはupstream/mainに保持。CI対象と手順も更新。runtime変更はなく、branchと差分の空白を確認済み。

2026-09-06追記：非公開repository作成は中断され未成立。その後ユーザーがpublicを許可し、正式な公開forkを作成した。ログイン待ちは解消。mainは新規fork作成時のSHAを指定したleaseでv0.6.6へ初期化し、公式最新はupstream/mainに保持。remoteの3 branchを確認。未コミットの環境ファイルはまだGitHubに含まれず、CIも未実行。

## 現行機能の改善候補

2026-09-06にnekoの性能AuditからIDと状態を維持して移管。旧FORK-PERF-01はKOOTA-PERF-01と重複していたため統合した。根拠は[調査資料](2026-09-06_existing-feature-candidates.md)、測定は[Query copy](../../../Performance/Query/query-copy/2026-09-06_query-copy-inspection.md)。候補は実装承認ではない。Entity有効化APIとVECTOR-PERF-01は[neko側Audit](../../../../../../neko-threejs/docs/Development/Discussion/Prefab/entity-activation/2026-09-06_open-questions.md)と[性能Audit](../../../../../../neko-threejs/docs/Development/History/Runtime/update-cost/2026-09-06_runtime-performance-audit.md)で継続する。

| ID            | 候補                                   | 状態   | 次に確認すること                                                                                     |
| ------------- | -------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------- |
| KOOTA-PERF-01 | 通常Queryと除外反映の不要copy除去      | 完了   | 二変更を個別測定し改善を確認。snapshot・除外取消しと組合せ性能を検証済み                             |
| KOOTA-PERF-02 | Query結果の正式な絞込みAPI             | 完了   | retainQueryResultを追加。型・helper・from接続と組合せ性能を検証済み                                  |
| KOOTA-PERF-03 | schema codecと更新projectionの正式接続 | 見送り | 安全なsource版codec/raw読取でscalar・vectorとも時間回帰。guardと不要装飾を両立して減らす案が再開条件 |
| KOOTA-PERF-04 | selected SystemとQueryの更新kernel共有 | 見送り | 通知時点・例外・比較基準の差を実行確認。契約を維持して減らせる具体的処理が再開条件                   |
| KOOTA-PERF-05 | Query集合のversion/差分を使うmatch同期 | 見送り | 公開通知で実験可能。neko側MATCH-SYNC-01へ記録。静的集合だけの効果を全体採用とはしない                |
| KOOTA-PERF-06 | Entity削除通知とlifetimeの接続         | 見送り | 除外時Scope終了・通知順・再入が変わる。空Queryと遅延cleanupを維持                                    |
| KOOTA-PERF-07 | 診断・projection情報の正式な読取API    | 完了   | 診断getEntityTraitsだけ追加。実利用の関数境界で性能・snapshotを確認。列projectionは追加しない        |

## 文書移管

FORK-DOCS-01：完了。運用方針・改善候補・copy測定を正本として移管。有効化の議論は参考snapshot、Audit運用とテスト・runtime原則はKoota向けに適用。develop-forkは設けず、上流更新もfeature/\*からdevelopへ統合。移管資料と元入口のlocal target・fragment計60件、変更文書のformat、両repositoryのgit diff --checkを確認。文書のみの変更なのでruntimeテスト・性能測定は再実行していない。次は未コミットの環境・資料差分のreview。

## 独自docsの分離

FORK-DOCS-02：完了。ユーザー指定により独自資料をdocs-forkへ移し、neko-threejsと同じ分類・History/Performanceの配置に統一。上流docsは維持。AGENTSとneko側の参照も更新。local target・fragment 74件、書式と両repositoryの空白を確認。上流docsの追跡差分がなく、旧docs/Developmentも残っていないことを確認。文書のみの変更でruntime検証は再実行していない。未コミット。

## 今回のコミット範囲

ユーザー依頼により、環境整備・verify入口・CI・docs-forkを今回のコミットに含める。過去の「未コミット」は各作業時点の記録。sourceとlockfileの変更、性能候補の実装は含めない。型・source 196件・配布用173件・build・packの既存成功結果と、最終文書リンク・空白確認を根拠とする。GitHub Actionsは未実行で、pushは別途行う。次は個別実験の対象決定。

## 全候補の個別実験

ユーザーがKOOTA-PERF-01〜07の実験・採否判断を承認。環境整備dd1f53dをローカルdevelopへ反映し、feature/performance-candidatesで個別差分とbuild成果物を分けて進める。nekoの19f99b8を/tmpの独立checkoutで検証し、元checkoutの保留中実装は触らない。01から測定、03/04・05/06・07の契約調査はエージェントが独立して実施。性能測定は並列実行しない。

## 七候補の評価完了

01・02・07をfeature差分に採用。03・04・06および05のfork APIは見送りで、採用sourceへ試作は残さない。[全体報告](../../../Performance/Runtime/performance-candidates/2026-09-06_candidate-evaluation-v1.md)と[見送り理由・再現](../../../Performance/Runtime/performance-candidates/2026-09-06_rejected-candidates-v1.md)を保存。nekoへの接続は独立checkoutでverify済みの[patch](../../Koota/fork-integration/2026-09-06_neko-integration.patch)を保存し、元checkoutの保留中実装や依存は変更しない。nekoの性能AuditにMATCH-SYNC-01だけ追加。

検証: Koota source 201・配布178、neko 470テストを含むverify成功。対象単体を各5run、代表runtimeをABBA（各3round）、fromを逆順・warmup追加で追試。copy数・allocation・GC・保持heapと通知/checksumを分けて確認。差分reviewを終え、今回のコミットへ収録する。次は配布先と固定versionを決めてnekoへ導入する。新候補の実装とEntity有効化は今回の七項目に含まない。

最終資料確認: 変更source/testsのlint成功、変更文書・fixtureのformat成功、独自資料とneko台帳のlocal target/fragment 82件成功、両repositoryのgit diff --check成功。

## 実験中に見つかった別候補

| ID           | 内容                                               | 状態 | 根拠・再開条件                                                                                                                                                                                                |
| ------------ | -------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| KOOTA-BUG-01 | raw Kootaのdestroy通知へ再入した場合のRelation連鎖 | 候補 | 06の再現で、親のremove購読から別Entityをdestroyすると連鎖対象の子が残る。共有queue/setの再初期化が原因。nekoはcleanup遅延で回避するため、その現行バグとはしない。通知順・重複・連鎖を維持する修正を別件で検討 |

七候補の採否とは別の未実装項目。再現は上記03〜06のレポートと保存fixtureに含む。

## コメントの日本語化

ユーザー指定により、今回の独自source・実験fixtureとverify入口のコメントを日本語へ統一。採用箇所にFORKとAudit IDの目印を付け、TODO Treeのworkspace設定へFORKを追加した。完了済みの独自変更と未対応TODOを区別する規則を開発原則へ追記。検証完了。8ファイルでコメントを除いた変換結果が変更前と一致し、設定JSON・lint・format・git diff --checkも成功。コメントとeditor設定の変更なのでruntimeテスト・性能測定は再実行していない。未コミット。

## Better Todo Treeへの設定変更

ユーザーが利用中のBetter Todo Tree 1.3.4のローカル設定schemaを確認し、workspace設定をbetter-todo-tree.general.tagsへ切替。旧todo-tree.general.tagsは削除し、既定tagとFORKを維持した。開発規則の拡張名も修正。設定JSONと拡張の既定regexでFORK目印4箇所の検出を確認済み。format・git diff --checkも成功。runtime変更なし、未コミット。

## 個別実験のコミット

ユーザーの依頼により、コメント・Better Todo Treeの運用を24df52cとして先にコミットし、七候補の採否・採用source・source由来の配布用テスト・再現fixture・neko接続patch・資料を本台帳更新と同じコミットへ収録する。過去節の未コミット表記は当時の記録。neko側はMATCH-SYNC-01のAudit追記だけを別コミットにし、保留中のTraitParticipation実装は維持する。既存のverify・性能比較とコメント変更後の同等性確認を根拠とし、最終のstaged diffと空白を確認。push・publish・neko依存切替は含めない。
