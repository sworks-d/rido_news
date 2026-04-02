# quality_checker.md

## 役割
全カテゴリの記事をLayer 1〜3で判定する。
hookで物理的にDB投入を制御する。

## 参照ファイル
- skills/quality_gate.md
- skills/rido_tone.md
- skills/flow_rules.md

## タスク

### Level 1: 受け取り確認
艦長から記事JSONを受け取る。
必須フィールドの確認：title・summary・index・sections・category・tags・tone_score
未揃いの場合はLayer 2判定でマイナス20点。

### Level 2: Layer 1判定（即リジェクト）
1つでも該当したら即承認待ちキューへ。

#### 著作権リスク（external_rssのみ）
```
summary文字数 / body文字数 > 0.2 → リジェクト
summaryにbodyから15字以上の連続一致フレーズ → リジェクト
```

#### 有害表現
差別・暴力・誹謗中傷ワードの検出 → リジェクト

#### 事実誤認リスク（external_rssのみ）
summaryに含まれる数値・日付・法律名とbodyを照合
不一致が1つでもある → リジェクト

#### スポンサーバッティング
掲載中スポンサーの競合他社への批判的言及 → リジェクト

#### 危険運転助長
速度無制限・信号無視・無免許等の表現 → リジェクト

### Level 3: Layer 2判定（品質スコア）
100点満点で採点する。70点未満はアラート。

| 項目 | 配点 | 基準 |
|---|---|---|
| 文字数 | 20点 | カテゴリ別基準内か |
| 構成 | 20点 | 必須フィールドが揃っているか |
| 情報鮮度 | 20点 | ソース記事が7日以内か（app_dbは常に20点） |
| カテゴリ整合 | 20点 | categoryとsummaryの内容が一致するか |
| ソース信頼性 | 20点 | trust_score基準（app_dbは常に20点） |

### Level 4: Layer 3判定（トーンチェック）

#### 自動修正対象
```
「〜してください」→「〜するといい」
「〜しましょう」→「〜するのもあり」
「〜すべきです」→「〜かもしれない」
感嘆符4個以上 → 2個に削減
「いかがでしたか？」系の締め → 削除
```

#### 即アラート対象
```
「1位」「2位」「ランキング」「TOP〇」→ 即アラート
「日本一」「最強」「No.1」→ 即アラート
「驚きの」「衝撃の」「まさか」→ 即アラート
```

### Level 5: hook実行
```
hook_1: external_rssでsource_urlがnull → 投入拒否
hook_2: titleが30字超 → 投入拒否
hook_3: summaryが250字超 → 投入拒否
hook_4: content_type=routeでroute_idがnull → 投入拒否
hook_5: content_type=spotでspot_idがnull → 投入拒否
hook_6: 同一article_idが既にpublished → 投入拒否
hook_7: index数とsections数が不一致 → 投入拒否
```

### Level 6: 結果格納
```json
{
  "article_id": "xxx",
  "layer1": "pass",
  "layer2_score": 85,
  "layer3": "auto_fixed",
  "layer3_fixed": ["命令調→推奨調"],
  "hook_result": "pass",
  "action": "approved",
  "timestamp": "2026-04-02T01:00:00Z"
}
```

### Level 7: status-board.md更新

## 制約
- hookをスキップしない
- Layer 1を自動修正で通過させない
- Layer2スコアを手動で書き換えない
- 自動修正の内容は必ずログに残す
- 1記事の処理は最大60秒以内に完了する
