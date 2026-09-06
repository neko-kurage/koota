# Koota fork候補03〜06の実験結果

2026-09-06。Koota 0.6.6とneko 19f99b8を対象に比較した。保留中のTraitParticipation差分は含めない。実験の再現方法とfixtureは、[再現fixture](../../../benches/fork/candidate-repros/README.md)を参照する。各候補の作業状態の正本は[fork Audit](../fork-audit.md)。

**03・04・06の今回の置換案は採用しない。05はKootaの追加APIを見送り、既存の公開通知を使うneko側の別候補として残す。** 実装を移しただけの整理や、契約を変えた比較を性能改善として数えない。

## 03: codecの正式接続とraw列読取

`setTraitCodec(trait, {encode, decode})`と`getTraitColumns(world, entity, trait)`を試作した。生成済みget/setへの接続は初期化時だけ行い、scalarの通常操作へcodec判定を追加しない。公開raw読取にはWorld・Entity生存・Trait残存の検査を入れ、別世代slotを読まないようにした。

最初の外部prototypeだけで結論せず、内部hasTrait/getEntityIdを使うsource版を通常の上流buildで配布物にし直した。型・対象testと、structured入力、get/set、readEach/updateEach、selected、例外時の未書戻し、借用失効、異World、Trait削除、古いEntity・slot再利用の実行確認は成功した。

### 配布物の比較

比較元は01+02入り、候補はそれに03だけを追加した配布物。Node 24.4.0、5000体、warmup150・sample200、A/B/B/A/A/Bの別processで各3run。他のbuild・計測を停止した。表は各runのp50の中央値。

| 処理            | 現行(ms) | 候補(ms) |    変化 |
| --------------- | -------: | -------: | ------: |
| scalar列読取    | 0.063000 | 0.097042 |  +54.0% |
| scalar selected | 0.817792 | 0.835667 |   +2.2% |
| vector列読取    | 0.103625 | 0.308417 | +197.6% |
| vector selected | 7.361875 | 7.609333 |   +3.4% |

全3runで同方向のp50回帰を確認した。selectedは実物の値編集経路を使い、context生成だけをstubにした切出しで、Prefab全体の測定ではない。vector selectedの基準p99には21.05msの外れ値があり、tail改善とは結論しない。時間回帰で受入条件を満たさないためallocation/GCの追加測定はしなかった。

nested object内vectorを5体のupdateEachで更新すると、snapshot装飾がroot/nested各5回、計10回走ることも確認した。今回のAPI正式化ではこの未使用装飾は減らない。Query全体をraw getterへ切り替えると公開snapshotの意味が変わる。

判断: 既存adapterを維持する。再開には、検査済みの内部計画へ安全に接続し、guardの二重実行と不要装飾を省きながらscalarも同等以上になる具体案が必要。

## 04: Queryとselected Systemの更新kernel共有

KootaのupdateEachと、neko HEADのSystemAttachment.invokeSelectedの値読取・借用・失効・書戻し・通知を実行して比較した。context生成invokeだけをcallback直呼出しへ置換した。以下は初期値0のEntityで再現した結果。

| 操作                                           | Query            | selected             |
| ---------------------------------------------- | ---------------- | -------------------- |
| 2体を1へ更新し、1体目のonChangeから2体目を読む | 1                | 0                    |
| 2体目のcallbackでthrow                         | 値[1,0]・通知0件 | 値[1,0]・先行通知1件 |
| draft.value=1と直接set(value=1,false)を重ねる  | 値1・通知0件     | 値1・通知1件         |

Queryはloop終了後、selectedは一体ずつ通知する。さらにQueryは現在store、selectedはcallback前copyとの比較で変更を判定するため、通知flush時点だけをoptionにしても同じ契約にならない。selectedにはscope終了・Trait残存の確認とalias重複の一回書戻しもある。

狭い読取共有は03の範囲になる。比較前copyをQueryへ一律追加すれば費用が増え、mode分岐・policy callbackを増やすkernelにも整理と性能の利益を示せなかった。二種類の生成kernelにしても二経路の保守は残る。

判断: 最小共有案は契約を変えるため見送り。異なる契約の案同士の時間比較は行わない。再開には契約統一の合意、または現行の通知・比較・scope契約を保って省ける具体的処理を示す必要がある。

## 05: Query集合同期のrevision共有

公開onQueryAdd/onQueryRemoveの一対からrevisionを更新し、phase境界で変更時だけ同期する試作を行った。5000対の購読では100回のremove/addで100万callback、一対の共有では200callbackだった。Prefabごとの直接購読は採用しない。

### 同期loopだけの比較

Node 24.4.0 arm64、Koota 0.6.6、5000体。countは1 attachment、singleは5000 attachment。変更ありは各tick50体のTrait切替。warmup50・sample180、各条件3run、A/B順を交互にした。表は各runのp50/p99の中央値、単位ms。更新対象数も照合した。

| 形     | 変更   | 基準 p50/p99        | 共有通知 p50/p99    | 同期回数 基準→候補 |
| ------ | ------ | ------------------- | ------------------- | ------------------ |
| count  | static | 0.363583 / 0.517583 | 0.098333 / 0.129500 | 180 → 0            |
| single | static | 0.303125 / 0.381958 | 0.105959 / 0.151666 | 900000 → 0         |
| count  | 1%     | 0.386833 / 0.758875 | 0.384791 / 0.870084 | 180 → 180          |
| single | 1%     | 0.295542 / 0.602833 | 0.287542 / 0.673042 | 900000 → 900000    |

Scope/Activity/awake/借用/context/Vector/from、初期購読・生成費用、allocation/GCは含まない。共有Queryが変わると全attachmentが再照合され、singleの変更ありでは省略量がない。頻繁な変更のp99も悪化方向なので、全体採用や性能同等とは結論しない。

Kootaの内部versionがsubscriptionの後に増えることも実行確認した。単に公開しても同期再入の扱いは解決しない。公開通知でneko側の試作が可能なため、forkへのversion/差分API追加は見送る。

neko側の別候補として、Query共有owner、scope破棄でのdirty化、from・固定local source、awake中の再変更とrevision保存点を含む全体実験を残す。今回の小型fixtureをそのまま本体へ採用しない。

## 06: Entity削除hookとcleanup

空QueryのremoveはIsExcluded追加時の生存Entityにも発生し、その後のdestroyでも発生する。現行EntityLifecycleは前者でもScopeを閉じるため、削除確定hookだけでは代替できない。

raw Kootaで、autoDestroy:'source'の親のremove通知から別Entityをdestroyすると、親・別Entityは死ぬが連鎖対象の子が生存する症状を再現した。destroyEntityが共有queue/setを再初期化するため。nekoはScope終了とresource cleanupを分けてflushまで遅延させ、この再入を避ける。nekoの現行cleanup不具合としては報告しない。

配布物の一時複製だけに、destroyのwhile loop後の実験hookを追加した。

| 終了時hookの対象                  | 親hookで別Entityをdestroyした時の通知 |
| --------------------------------- | ------------------------------------- |
| 共有processedEntitiesを直接走査   | 親→別→別。子の通知欠落                |
| processedEntitiesのsnapshotを走査 | 親→別→子。三体ともdead                |

snapshotならこの再入例は処理できるが、追加copyが必要で、元の空Query通知との時点も異なる。さらにIsExcludedの補完にonAddを使うと、他のQuery remove購読から見たScope終了状態がclosed=trueからfalseへ変わるケースを再現した。

判断: 空Queryとdeferred cleanupを維持する。正しさが等しくないhook案の時間を速さの根拠として測らない。再開には、除外・削除開始・確定・連鎖完了のどこでScopeを閉じ、既存購読へいつ見せるかを別設計として決める必要がある。

## 再現の保存範囲

再現fixtureは元配布物を書き換えず、03はsourceを独立checkoutでbuildし、06のhookは破棄可能な配布物複製だけに挿入する。05/06の通常probeは配布物を読込むだけ。06のhook挿入はv0.6.6 bundle形状専用で、形が変われば停止する。fixtureはruntimeへ組み込まない。

測定値は上記集約表を正本とし、一時ディレクトリやraw全sampleを参照しない。再測定ではREADMEの条件と基準・候補artifactを記録する。候補を再構築できない場合に、別のAPI・別versionの値をこの比較の再現とみなさない。
