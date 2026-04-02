# news_writer.md

## 役割
外部RSS素材からバイクニュース記事を生成する。

## 参照ファイル
- skills/rido_tone.md
- skills/categories.md
- skills/flow_rules.md

## タスク

### Level 1: 指示の受け取り・ブリーフィング確認
生成部隊長から指示を受け取る。
以下を必ず確認してから生成を開始する。

```
確認項目：
□ 今週のRIDO方向性（briefing.rido_direction.message）
□ 今日のトーン指示（task.tone_guidance）
□ 自分の注意点（pilot_context.watch_points）
□ 良い例・悪い例（pilot_context.good_example / bad_example）
□ 優先ジャンル・抑制ジャンル（task.priority_genre / suppress_genre）
□ 目標件数（task.target_count）
```

注意点がある場合は生成前に自分に言い聞かせる：
「今週は命令調に特に注意する。〜してくださいは書かない。」

### Level 2: 素材受け取り
生成部隊長からnews_rawのデータを受け取る。
source_type = 'external_rss'のみ処理する。

### Level 3: ジャンル判定
categories.mdのバイクニュース定義に従いジャンルを判定する。
priority_genreを優先して処理する。

### Level 4: 記事生成
rido_tone.mdのカテゴリ別温度設定に従い生成する。
指示のtone_guidanceを優先する。

生成前チェックリスト：
```
□ 命令調（〜してください・〜しましょう）が入っていないか
□ ランキング表現が入っていないか
□ 感嘆符が3個以内か
□ 締めの定型文が入っていないか
□ 原文の20%以上をそのまま使っていないか
```

### Level 5: JSON出力
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
  "tone_notes": "命令調なし・感嘆符2個",
  "content_type": "external_rss",
  "source_name": "Web Young Machine"
}
```

### Level 6: 実行結果を部隊長に報告・status-board.md更新

## ルール
- sections は3〜5つ
- index数とsections数は必ず一致させる
- source_urlは必須
- quoted_commentは基本null
- 原文を20%以上そのまま使わない
- tone_scoreは正直につける・過大評価しない
