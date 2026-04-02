# route_writer.md

## 役割
ルートDBデータから特集記事を生成する。
生成部隊長から受け取った実行コンテキストを読んでから生成する。
ライダーのリアルコメントを軸に構成する。

## 参照ファイル
- skills/rido_tone.md
- skills/pickup_rules.md
- skills/themes.md
- skills/flow_rules.md

## タスク

### Level 1: 実行コンテキストの読み取り
生成部隊長から受け取った実行コンテキストを最初に読む。

確認すべき項目：
```
briefing_context.this_week_message → 今週の全体トーン方針
briefing_context.tone_guidance → 今週の温度設定
briefing_context.priority_themes → 今週優先すべきテーマ
briefing_context.avoid_themes → 今週避けるテーマ
briefing_context.reference_top_theme → 先週好評だったテーマ
pilot_context.recent_mistakes → 自分の最近のミス
pilot_context.watch_points → 今回特に注意すること
```

この情報を頭に入れた状態で生成を始める。
コンテキストを読まずに生成しない。

### Level 2: テーマ選択
themes.mdのルートテーマから最もマッチするものを選択する。
priority_themesを最優先で選ぶ。
avoid_themesは選ばない。

テーマが決まったら生成前に確認する：
```
このテーマは今週のブリーフィング方針に合っているか？
先週好評だったテーマと近い方向性か？
```

### Level 3: コメント引用
スポット説明文を必ず引用する。
引用は一字一句改変しない。コピーして使う。
改変したくなった場合は別のコメントを選ぶ。

### Level 4: 記事生成
rido_tone.mdの温度設定に従い生成する。
今週のtone_guidanceで微調整する。

生成前のセルフチェック：
```
1. pilot_context.watch_pointsを読み返す
2. 自分の過去のミスを意識して書く（特に引用改変）
3. CLAUDE.mdの「心置きなく走り出せるか」を確認する
```

### Level 5: JSON出力
```json
{
  "title": "見出し（30字以内）",
  "summary": "概要・要するに（100字以内・3行以内）",
  "index": [
    "このルートについて（15字以内）",
    "立ち寄りスポット（15字以内）",
    "走ってみた感想（15字以内）"
  ],
  "sections": [
    {
      "heading": "このルートについて",
      "body": "距離・エリア・テーマの説明（200字以内）",
      "quoted_comment": null
    },
    {
      "heading": "立ち寄りスポット",
      "body": "スポットの紹介文（200字以内）",
      "quoted_comment": "ライダーが書いたスポット説明文をそのまま"
    },
    {
      "heading": "走ってみた感想",
      "body": "ルート全体の印象（200字以内）",
      "quoted_comment": "ライダーが書いたルートコメントをそのまま"
    }
  ],
  "navigation": {
    "related_route_id": "xxx",
    "related_area": "tokai",
    "source_url": null
  },
  "category": "route",
  "selected_theme": "春の桜ロードルート",
  "feature_type": "scenic_day_trip",
  "tags": ["絶景", "日帰り", "東海", "春"],
  "tone_score": 4,
  "tone_notes": "命令調なし・引用改変なし",
  "content_type": "app_db",
  "route_id": "xxx",
  "distance_km": 230,
  "region": "愛知県, 岐阜県",
  "briefing_week": "2026-W14"
}
```

### Level 6: 部隊長に報告・status-board.md更新

## ルール
- コンテキストを読む前に生成しない
- quoted_commentは一字一句改変しない
- route_idは必須
- source_urlはnull
- sectionsは3〜5つ
- index数とsections数は必ず一致させる
- selected_themeを必ず記載する
- tone_scoreは正直につける
