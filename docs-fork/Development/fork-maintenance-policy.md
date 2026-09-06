# Koota forkの上流追従方針

2026-09-06。neko `442b5f7`、Koota 0.6.6から開始するforkの採用方針。公開forkと環境は準備済み。個別性能実験は実施済み、nekoの依存切替は未実施。状態は[fork Audit](audit.md)、手順は[開発環境](fork-workflow.md)、候補は[調査資料](History/Runtime/performance-candidates/2026-09-06_existing-feature-candidates.md)を参照する。

## 基本方針

**上流の構成を維持した別repositoryに、小さく理由を追える変更を積む。更新は検証用branchへ取り込み、現在採用中のforkより遅くならないことを確認してからnekoの依存を更新する。** 追従しやすさやコード整理を理由に性能劣化を受け入れない。

小さい差分とは行数だけでなく、変更理由と影響範囲を限定できることを指す。変更を一か所へ集めるために、毎Entityで汎用hook・動的dispatch・追加allocationを通す設計にはしない。hot pathでは上流の関数への小さな直接修正も許容する。

## 1. 上流の配置と履歴を残す

forkは上流のGit履歴、package構成、ファイル配置、build手順、コードスタイルを維持する。nekoのclass化・命名・format規則をfork全体へ適用しない。生成されたdistへ直接patchせず、sourceを変更して配布物をbuildする。

upstream remoteは公式repository、originはforkとする。上流のrelease tagとcommit SHAを基準として、現在のforkから作った検証用branchへmergeする。検証が通るまで配布用branch・nekoの依存は更新しない。公開済みのcommit・release tagは書き換えない。fetchとmergeによる同期は[GitHubの公式手順](https://docs.github.com/en/pull-requests/how-tos/work-with-forks/syncing-a-fork)に沿う。

同じ競合の解消は[Git rerere](https://git-scm.com/docs/git-rerere)で補助できるが、再適用した内容もreviewと検証の対象とする。merge成功は意味や性能の互換性を保証しない。

## 2. 変更の種類と責務を分ける

| 変更                     | 方針                                                                                          |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| Koota単体にも有益な修正  | Queryの不要copy除去など。独立commitと最小再現を持たせ、更新時に維持・削除を判断できる形にする |
| nekoとの接続に必要な拡張 | Query結果やschemaへの狭いAPI。Kootaのstorage・Query責務に限り、未使用の通常経路も計測する     |
| neko固有の意味           | Prefab階層、Component契約、ownの所有期間、Asset変換などはnekoに残す                           |
| 配布・検証の設定         | runtime変更と別commitにし、upstreamのbuild変換と成果物の性質を保つ                            |

各変更にID、理由、上流base SHA、関連commit、契約の検証、性能結果、上流での同等修正の有無、独自差分を消せる条件を記録する。コードには局所的に分かりにくい実装理由を書く。上流が同じ問題を解決したら、独自修正を残し続けず、契約と性能を比較して置き換える。上流へのPRは前提にしない。コミットメッセージは日本語でよい。

## 3. 依存は検証済みの成果物へ固定する

現在の`koota: ^0.6.6`はfork導入時に厳密なversion指定へ変更し、lockfileのintegrityとforkのsource SHAを対応付ける。配布先は未決定だが、build済みの不変なpackageを使い、可変branchや最新版へ直接依存しない。package aliasで既存の`koota`というimport名を維持する案を優先し、公開宣言・bundlerを含めて検証する。

導入済みpackageにはcollectionsの先行buildなどの手順があり、inline変換用の依存もある。ソースを単にコピーしたり別のbundlerでまとめたりせず、上流のbuild設定を確認して維持する。比較も実際に配布する成果物で行う。

実行時のKootaは一つに揃える。現行実装は数値Entityの操作をNumber.prototypeへ登録し、Worldの識別にも共有状態を使うため、公式版とforkを同じprocessへ読み込む比較や二重依存を避ける。A/B計測は別processで行い、core・assets・standardのpack後も依存と型の接続を確認する。

## 4. 性能の受入条件

比較の主基準は、**同じnekoコードで動く現在採用中のfork**。初回は現行公式版となる。新しい上流だけを基準にすると、上流由来の劣化を見落とす。原因を分ける必要があれば公式版の新旧も別途比較する。

固定した環境・toolchain・build条件で、warmup後にA/Bの順序を交互または無作為にして複数回測る。測定結果にはrevision、実行環境、条件とばらつきを残す。時間測定とallocation・GC診断は計測器の負荷を混同しないよう分ける。

| 観点                 | 代表的な確認対象                                                                      |
| -------------------- | ------------------------------------------------------------------------------------- |
| 更新時間             | Koota直接、Project一括、Prefab local。scalarとvectorを別々に、p50とp99を確認          |
| 生成・破棄・集合変更 | spawn/dispose、Trait追加削除、Queryからの大量除外、有効化切替を導入した場合はその切替 |
| 利用形               | countと個別Prefab、from、Transform、影響するComponent。新機能を使わない場合も含む     |
| メモリ               | allocation、GC停止、保持メモリ。CPU改善と引換えに別の劣化を隠さない                   |

変更箇所の集中測定に加え、既存の代表経路を確認する。新しい拡張は外側で同じ意味を実現する方法とも比較する。Vectorが速くてもscalarが遅くなった案は採用しない。

「5%までは劣化を許す」のような許容枠は設けない。再現する劣化は不採用、測定ノイズで判断できなければ追加測定または保留とする。有限の計測で全状況の無劣化を証明はできないため、測定範囲と不確実性を明記し、処理回数・allocation・計算量の確認も併用する。小さな劣化の累積を見逃さないよう、現在版に加え固定した採用時点との比較も残す。

機能修正は契約上必要かを別途判断する。最適化・整理は従来どおり、効果があれば採用し、効果がなければ性能が同等かつ全体のコードが分かりやすくなる場合だけ残す。forkへコードを移しただけでは整理の成果としない。

## 5. 一回の更新手順

1. 上流releaseとの差分と、保持している独自変更の一覧を読む。不要になった独自変更と、契約が変わる箇所を特定する。
2. 検証用branchでmergeし、競合解消をreviewする。無関係なformat・rename・最適化を混ぜない。
3. 上流テストとfork固有の回帰確認、nekoの型・lifetime・通知・例外・cleanup契約を検証する。game-state rollbackは導入しない。
4. 配布物をbuildし、nekoの既存verifyと性能比較を行う。失敗したら原因を分け、修正して再測定する。
5. 契約と性能を維持できたものを不変なversionで配布し、nekoのversionとlockfileを更新する。結果と独自差分一覧を記録する。

劣化を解消できなければ上流更新を保留する。必要な修正だけ独立して取り込める場合はbackportし、それ自体を検証する。最新化を理由に受入条件を緩めない。

## 個別実験の記録

初回は[Queryのcopy調査](Performance/Query/query-copy/2026-09-06_query-copy-inspection.md)から始め、七候補を一つずつ比較した。採否・検証範囲・再開条件は[性能実験](Performance/Runtime/performance-candidates/2026-09-06_candidate-evaluation-v1.md)と[Audit](audit.md)を正本とする。新しい候補や上流更新でも、一括変更する前に独立した比較を行う。

forkはneko-kurage/koota。package配布先と固定versionは導入時に決める。Entity有効化の契約変更と、既存機能の最適化を混ぜない。
