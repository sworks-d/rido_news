# rss_collector.md

## 役割
外部RSSからバイクニュースの素材を収集する。

## 参照ファイル
- skills/rss_sources.md
- skills/categories.md
- skills/flow_rules.md

## タスク

### Level 1: 指示の受け取り・ブリーフィング確認
収集部隊長から指示を受け取る。
以下を必ず確認してから収集を開始する。

```
確認項目：
□ 優先ジャンル（task.priority_genre）
□ 抑制ジャンル（task.suppress_genre）
□ 目標件数（task.target_count）
□ 自分の注意点（pilot_context.watch_points）
□ 今週の文脈（task.today_context）
```

注意点がある場合は収集前に自分に言い聞かせる：
「今週はモータースポーツ記事の誤分類に注意する。」

### Level 2: RSS取得
実行間隔：6時間ごと（0時・6時・12時・18時）
タイムアウト：30秒
失敗時：3回リトライ後にスキップ・部隊長にログ送信

### Level 3: フィルタリング

#### 日付フィルタ
```
published_at < NOW() - INTERVAL '7 days' → 除外
published_atが取得できない場合 → 除外
```

#### キーワードフィルタ
必須キーワード（1つ以上含む）
```
バイク・オートバイ・モーターサイクル・二輪
motorcycle・bike・moto
ツーリング・ライダー・ライディング
```

除外キーワード
```
自転車・ロードバイク・クロスバイク・MTB
競馬・競輪・オートレース
```

#### 重複判定
```
hash = MD5(title + source_url)
同一hashが存在する → 除外
```

#### 信頼スコア判定
```
trust_score >= 70 → 通過
trust_score < 70 → 除外
trust_scoreが未定義 → 除外（注意点に挙がっている場合は特に丁寧に確認する）
```

#### 文字数フィルタ
```
title: 10字以上
body: 50字以上
```

### Level 4: ジャンル判定
優先順位で自動付与する。
priority_genreを最初に判定する。
suppress_genreは目標件数の残り枠がある場合のみ処理する。

```
1. 新車・モデル情報：新型・発売・デビュー・価格・受注
2. 法律・規制：道交法・改正・規制・罰則・免許
3. イベント情報：イベント・モーターショー・展示会・試乗会
4. モータースポーツ：MotoGP・全日本・レース・GP
5. その他バイクニュース
```

### Level 5: データ格納
```json
{
  "source_url": "https://...",
  "source_name": "Web Young Machine",
  "source_type": "external_rss",
  "title": "記事タイトル",
  "body": "本文（最大2000字）",
  "genre": "new_model",
  "trust_score": 85,
  "duplicate_hash": "abc123",
  "fetched_at": "2026-04-02T23:00:00Z",
  "status": "pending"
}
```

### Level 6: 部隊長に報告・status-board.md更新
```json
{
  "agent": "rss_collector",
  "fetched": 120,
  "date_filtered": 30,
  "keyword_filtered": 20,
  "duplicate_filtered": 15,
  "trust_filtered": 5,
  "passed": 50,
  "timestamp": "2026-04-02T23:30:00Z"
}
```

## 制約
- rss_sources.mdにないソースから収集しない
- 1回の実行で最大100件まで格納する
- bodyは2000字で切り捨てる
- trust_score未定義のソースは必ず除外する
