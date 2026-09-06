# neko fork 開発環境

## 現在の構成

- upstream: pmndrs/koota。公式上流はupstream/mainで追跡する。
- main: 検証済みの安定版。
- develop: 開発統合branch。
- feature/*: 個別変更と実験の作業branch。
- origin: git@github.com:neko-kurage/koota.git。公開forkへ接続済み。
- Node: .node-version、pnpm: package.jsonのpackageManagerに固定する。

neko-threejsの作業ルール・Audit・一括検証という構成を参考にする。上流のsource配置、pnpm workspace、formatterとbuildは維持する。runtime候補の採否と検証は[Audit](audit.md)を参照する。

## 作業開始

```sh
corepack pnpm install --frozen-lockfile
node scripts/verify-fork.mjs
```

検証は型、sourceテスト、上流build、生成された配布用テスト、packの順。成果物は.artifactsに置く。公開はしない。通常の変更では関連するテストを先に実行する。

## Git

main・develop・feature/\*を使い、develop-forkは追加しない。上流へのPRは前提にせず、コミットメッセージは日本語でよい。fork内のPRも必須ではなく、差分を確認してローカルでmergeできる。

repository内だけrerere.enabled=true、rerere.autoupdate=false、pull.ff=only、push.default=simpleを設定済み。upstreamへのpushとmainからの既定pushは無効な送り先にしている。global設定は変更しない。

作業branchを明示してoriginへpushする。mainとdevelopは導入中のv0.6.6を基準にした履歴を持つ。mainへは検証済みのdevelopを反映する。

更新時はupstreamをfetchし、developからfeature/配下に検証branchを作って対象releaseをmergeする。競合解消はrerereによるものもreviewする。検証後にのみdevelopへ反映し、公開済み履歴・tagを書き換えない。

## 性能比較と利用側への接続

比較用worktreeは.worktrees配下にdetachedで作れる。各worktreeで同じNode・pnpmを使ってinstall/buildし、packした成果物を別のneko検証checkoutへ入れる。現在のneko作業checkoutの依存やlockfileは変更しない。公式版とforkを同じprocessに読み込まない。

```sh
git worktree add --detach .worktrees/baseline v0.6.6
```

本番相当の比較では基準と候補を別processで交互に測る。共有CIの時間だけで性能同等とは判断しない。既存経路の遅延・allocation・GCの劣化を受け入れず、判断不能なら保留する。環境構築時のテスト成功は性能検証の代わりにならない。

## CIと公開

fork-checks.ymlはmain・develop・feature/\*のpush、main・developへのPR、手動起動で検証を行う。性能の最終判定は固定環境で行う。上流のcanary公開・Pages workflowは公式repositoryでのみ動くよう条件を追加した。GitHub Actionsは有効化済み。統合するrevisionの検証結果を確認する。npm・GitHub Releases・Pagesへの公開は行わない。

## 作業の記録

[fork Audit](audit.md)で変更理由、状態、検証と次の作業を追跡する。Prefab・Componentのlifetime契約はneko側に残す。hot pathへgame-state rollbackを導入しない。cleanupとborrowed値の寿命チェックは維持する。

## 関連する方針

[資料一覧](00_index.md)、[上流追従方針](fork-maintenance-policy.md)、[開発原則](development-rules.md)、[Audit運用](History/Documentation/layout/2026-09-06_previous-audit-workflow.md)を参照する。

## 自分用の固定配布物

配布先はneko repository内のvendorとする。registry・GitHub Releases・release tagは使わず、隣接checkoutへの依存も置かない。GitHubへのsourceのpushと、packageの公開は別の操作。

1. sourceをコミットし、固定したNode・pnpmで`node scripts/verify-fork.mjs`を通す。
2. `.artifacts/koota-<上流version>.tgz`を空の一時directoryへ展開する。上流package.jsonのversionだけ`<上流version>-neko.<N>`へ変えて再梱包する。source側の上流versionは変更しない。
3. nekoのvendorへ新しいtgzとmanifestを置く。manifestにはsource commit・toolchain・tgzのSHA-512を残す。基準からのsource patchを同梱する場合は基準commitとpatchのSHA-256も記録する。
4. nekoの依存とlockfileを更新し、verifyとCoreの同梱インストールを確認する。性能に関わるsource変更は既存の受入方針で比較する。
5. 採用した配布物と記録をnekoでコミットする。forkではfeatureをdevelopへ統合してCIを確認し、検証済みのdevelopをmainへ反映する。PRは必須にしない。

`N`は同じ上流version内で1から増やすローカル通番。導入済みのtgzを再生成・上書きせず、再梱包でbytesが変わる場合も次の番号にする。現在採用しているversion・hashの正本はnekoのvendor manifestとlockfileで、ここには重複記載しない。追加の公開作業は完了条件に含めない。
