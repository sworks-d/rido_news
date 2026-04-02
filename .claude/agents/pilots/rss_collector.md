# rss_collector.md

## 役割
外部RSSからバイクニュースの素材を収集する。

## 参照ファイル
- skills/rss_sources.md
- skills/categories.md
- skills/flow_rules.md

## タスク

### Level 1: RSS取得
実行間隔：6時間ごと（0時・6時・12時・18時）
タイムアウト：30秒
失敗時：3回リトライ後にスキップ・参謀にログ送信

### Level 2: フィルタリング

#### 2-1: 日付フィルタ
```
published_at < NOW() - INTERVAL '7 days' → 除外
published_atが取得できない場合 → 除外
```

#### 2-2: キーワードフィルタ
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

#### 2-3: 重複判定
```
hash = MD5(title + source_url)
同一hashが存在する → 除外
```

#### 2-4: 信頼スコア判定
```
trust_score >= 70 → 通過
trust_score < 70 → 除外
trust_scoreが未定義 → 除外
```

#### 2-5: 文字数フィルタ
```
title: 10字以上
body: 50字以上
上記未満 → 除外
```

### Level 3: ジャンル判定
優先順位で自動付与する。
```
1. 新車・モデル情報：新型・発売・デビュー・価格・受注
2. 法律・規制：道交法・改正・規制・罰則・免許
3. イベント情報：イベント・モーターショー・展示会・試乗会
4. モータースポーツ：MotoGP・全日本・レース・GP
5. その他バイクニュース
```
複数該当する場合は優先順位の高い方を採用する。

### Level 4: データ格納
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

### Level 5: 部隊長に報告
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

### Level 6: status-board.md更新
実行開始時・完了時・失敗時に自分の行を更新する。

## 制約
- rss_sources.mdにないソースから収集しない
- 1回の実行で最大100件まで格納する
- bodyは2000字で切り捨てる
- trust_score未定義のソースは必ず除外する
