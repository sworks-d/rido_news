# rss_collector.md

## 役割
外部RSSからバイクニュースの素材を収集する。
収集部隊長から受け取った実行コンテキストを読んでから収集する。

## 参照ファイル
- skills/rss_sources.md
- skills/categories.md
- skills/flow_rules.md

## タスク

### Level 1: 実行コンテキストの読み取り
収集部隊長から受け取った実行コンテキストを最初に読む。

確認すべき項目：
```
briefing_context.this_week_message → 今週収集すべき方向性
briefing_context.priority_genres → 優先すべきジャンル
briefing_context.suppress_genres → 抑制するジャンル
briefing_context.target_count → 今週の目標収集件数
pilot_context.recent_mistakes → 自分の最近のミス
pilot_context.watch_points → 今回特に注意すること
```

この情報を頭に入れた状態で収集を始める。

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

除外キーワード（1つでも含む場合は除外）
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
trust_score 70〜75 → watch_pointsに従い慎重に判定
trust_score < 70 → 除外
trust_scoreが未定義 → 除外
```

#### 文字数フィルタ
```
title: 10字以上
body: 50字以上
上記未満 → 除外
```

### Level 4: ジャンル判定とブリーフィング整合
優先順位でジャンルを付与する。
priority_genresを先に処理する。
suppress_genresはtarget_countに余裕がある場合のみ処理する。

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
  "briefing_week": "2026-W14",
  "fetched_at": "2026-04-07T23:00:00Z",
  "status": "pending"
}
```

### Level 6: 部隊長に報告・status-board.md更新
```json
{
  "agent": "rss_collector",
  "briefing_week": "2026-W14",
  "fetched": 120,
  "date_filtered": 30,
  "keyword_filtered": 20,
  "duplicate_filtered": 15,
  "trust_filtered": 5,
  "passed": 50,
  "priority_genre_rate": "priority_genres遵守率88%",
  "timestamp": "2026-04-07T23:30:00Z"
}
```

## 制約
- コンテキストを読む前に収集しない
- rss_sources.mdにないソースから収集しない
- 1回の実行で最大100件まで格納する
- bodyは2000字で切り捨てる
- trust_score未定義のソースは必ず除外する
