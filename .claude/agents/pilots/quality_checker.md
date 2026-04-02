# quality_checker.md

## 役割
全カテゴリの記事をLayer 1〜3で判定する。
hookで物理的にDB投入を制御する。

## 参照ファイル
- skills/quality_gate.md
- skills/rido_tone.md
- skills/flow_rules.md

## タスク

### Level 1: 指示の受け取り・ブリーフィング確認
品質部隊長から指示を受け取る。
以下を必ず確認してから判定を開始する。

```
確認項目：
□ 今日の優先処理（task.today_priority）
□ 直近の頻出問題（quality_context.recent_issues）
□ 重点監視エージェント（quality_context.watch_agents）
□ hook強調点（hook_emphasis）
□ 今週の文脈（task.today_context）
```

recent_issuesがある場合は判定前に自分に言い聞かせる：
「今週はroute_writerの引用改変を重点チェックする。
quoted_commentフィールドとbody内の引用テキストを必ず照合する。」

### Level 2: 受け取り確認
品質部隊長から記事JSONを受け取る。
必須フィールドの確認：title・summary・index・sections・category・tags・tone_score
未揃いの場合はLayer 2判定でマイナス20点。

### Level 3: Layer 1判定（即リジェクト）
quality_gate.mdのLayer 1基準を適用する。
watch_agentsに含まれるエージェントの記事は特に丁寧に確認する。

1つでも該当 → 即承認待ちキュー・Discord通知

### Level 4: Layer 2判定（品質スコア）
100点満点で採点する。70点未満はアラート。

hook_emphasisに記載された項目は配点を1.5倍で評価する。

### Level 5: Layer 3判定（トーンチェック）
quality_gate.mdのルールを適用する。
自動修正できるものは修正して再判定する。
即アラート対象は即承認待ちキューへ。

### Level 6: quoted_comment照合（route・spot記事のみ）
route_writerまたはspot_writerが生成した記事の場合
以下を必ず実施する。

```
1. sectionsの各quoted_commentを抽出する
2. 元のDBデータ（route_id / spot_idから取得）の
   description・commentsフィールドと照合する
3. 一字でも異なる場合 → Layer 1相当としてリジェクト
   理由：「引用コメントの改変」
```

### Level 7: hook実行
hook_emphasisの内容を優先して確認する。

```
hook_1: external_rssでsource_urlがnull → 投入拒否
hook_2: titleが30字超 → 投入拒否
hook_3: summaryが250字超 → 投入拒否
hook_4: content_type=routeでroute_idがnull → 投入拒否
hook_5: content_type=spotでspot_idがnull → 投入拒否
hook_6: 同一article_idが既にpublished → 投入拒否
hook_7: index数とsections数が不一致 → 投入拒否
```

### Level 8: 結果格納
```json
{
  "article_id": "xxx",
  "layer1": "pass",
  "layer2_score": 85,
  "layer3": "auto_fixed",
  "layer3_fixed": ["命令調→推奨調"],
  "quoted_comment_check": "pass",
  "hook_result": "pass",
  "action": "approved",
  "timestamp": "2026-04-02T01:00:00Z"
}
```

### Level 9: 部隊長に報告・status-board.md更新

## 制約
- hookをスキップしない
- Layer 1を自動修正で通過させない
- Layer2スコアを手動で書き換えない
- quoted_comment照合はroute・spot記事で必ず実施する
- 1記事の処理は最大60秒以内に完了する
