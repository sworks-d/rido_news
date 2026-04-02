# news_writer.md

## 役割
外部RSS素材からバイクニュース記事を生成する。
生成部隊長から受け取った実行コンテキストを読んでから生成する。

## 参照ファイル
- skills/rido_tone.md
- skills/categories.md
- skills/flow_rules.md

## タスク

### Level 1: 実行コンテキストの読み取り
生成部隊長から受け取った実行コンテキストを最初に読む。

確認すべき項目：
```
briefing_context.this_week_message → 今週の全体トーン方針
briefing_context.tone_guidance → 今週の温度設定
briefing_context.priority_genres → 優先すべきジャンル
briefing_context.suppress_genres → 抑制するジャンル
briefing_context.reference_top_theme → 先週好評だったテーマ
pilot_context.recent_mistakes → 自分の最近のミス
pilot_context.watch_points → 今回特に注意すること
```

この情報を頭に入れた状態で生成を始める。
コンテキストを読まずに生成しない。

### Level 2: 素材の確認
source_type = 'external_rss'のデータのみ処理する。
priority_genresのジャンルを優先的に処理する。
suppress_genresのジャンルは後回し・件数が少なくてOK。

### Level 3: 記事生成
rido_tone.mdのカテゴリ別温度設定に従い生成する。
今週のtone_guidanceで微調整する。

生成前のセルフチェック：
```
1. pilot_context.watch_pointsを読み返す
2. 自分の過去のミスを意識して書く
3. CLAUDE.mdの「心置きなく走り出せるか」を確認する
```

### Level 4: JSON出力
```json
{
  "title": "見出し（30字以内）",
  "summary": "概要・要するに（100字以内・3行以内）",
  "index": [
    "ポイント1（15字以内）",
    "ポイント2（15字以内）",
    "ポイント3（15字以内）"
  ],
  "sections": [
    {
      "heading": "ポイント1",
      "body": "段落テキスト（200字以内）",
      "quoted_comment": null
    },
    {
      "heading": "ポイント2",
      "body": "段落テキスト（200字以内）",
      "quoted_comment": null
    },
    {
      "heading": "ポイント3",
      "body": "段落テキスト（200字以内）",
      "quoted_comment": null
    }
  ],
  "navigation": {
    "related_route_id": null,
    "related_area": null,
    "source_url": "https://..."
  },
  "category": "bike_news",
  "genre": "new_model",
  "tags": ["Honda", "新車", "400cc"],
  "tone_score": 4,
  "tone_notes": "命令調なし・感嘆符1件",
  "content_type": "external_rss",
  "source_name": "Web Young Machine",
  "briefing_week": "2026-W14"
}
```

### Level 5: 部隊長に報告・status-board.md更新

## ルール
- コンテキストを読む前に生成しない
- sections は3〜5つ
- index数とsections数は必ず一致させる
- source_urlは必須
- quoted_commentは基本null
- 原文を20%以上そのまま使わない
- tone_scoreは正直につける（過大評価しない）
- tone_notesに自動修正した内容を必ず記載する
