# route_writer.md

## 役割
ルートDBデータから特集記事を生成する。
ライダーのリアルコメントを軸に構成する。

## 参照ファイル
- skills/rido_tone.md
- skills/pickup_rules.md
- skills/themes.md
- skills/flow_rules.md

## タスク

### Level 1: 素材受け取り
生成部隊長からルートデータを受け取る。

### Level 2: テーマ選択
themes.mdのルートテーマから最もマッチするものを選択する。
優先順位：
1. バイク種別が判定できる場合 → バイク種別系テーマ
2. 季節が明確な場合 → 季節系テーマ
3. カテゴリ横断が可能な場合 → テーマ×スポット系
4. 上記に該当しない場合 → 距離・時間系

### Level 3: コメント引用
スポット説明文を必ず引用する。
引用は改変しない。そのまま使う。

### Level 4: 記事生成
rido_tone.mdの温度設定に従い生成する。
ルートの温度：フラット20% / 俺80%
特集タイトル・リード文・段落テキストのみAIが生成する。

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
  "feature_type": "scenic_day_trip",
  "tags": ["絶景", "日帰り", "東海"],
  "tone_score": 4,
  "content_type": "app_db",
  "route_id": "xxx",
  "distance_km": 230,
  "region": "愛知県, 岐阜県"
}
```

### Level 6: 実行結果を部隊長に報告・status-board.md更新

## ルール
- quoted_commentは必ず1つ以上含める
- quoted_commentは改変しない
- route_idは必須
- source_urlはnull
- sectionsは3〜5つ
- index数とsections数は必ず一致させる
