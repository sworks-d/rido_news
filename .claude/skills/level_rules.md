# level_rules.md

## エージェント精度管理ルール

---

## 基本概念

全エージェントは最初から自律的に動く。
成長とは「判断精度の向上」であり「できることが増える」ではない。

### 精度が上がる仕組み
判断した内容・結果・採用/却下を全て記録する。
この履歴が経験値になる。
整備士が経験値ログを読んでskillsファイルに知見を追記していく。
蓄積されるほど判断がブレなくなる。

### 成長指標
```
経験値 = 採用された判断の累積数
精度 = 採用率（採用数 / 全判断数）
```

---

## 精度計測の対象

| エージェント | 計測対象 |
|---|---|
| 収集パイロット | 収集精度（通過率/総収集数） |
| 生成パイロット | 採用率（採用数/生成数） |
| 品質パイロット | 判定精度（自動修正成功率・誤検知率） |
| 配信パイロット | 時間通り配信率・リトライ発生率 |
| 整備士 | skills更新の効果（更新前後の精度変化） |

---

## 判定の記録（全エージェント共通）

実行後に必ずSupabaseのagent_decisionsに記録する。

```json
{
  "agent": "news_writer",
  "decision_type": "article_generation",
  "action": "generated",
  "result": "approved",
  "reason": null,
  "adopted": true,
  "timestamp": "2026-04-02T06:00:00Z"
}
```

---

## 週次精度レポート（参謀が集計）

```
【組織精度レポート】
集計期間：〇〇〜〇〇

■ パイロット精度
news_writer：87%（経験値142件）先週比+3%
route_writer：78%（経験値98件）先週比-3%
spot_writer：92%（経験値234件）先週比+1%

■ 精度向上TOP
news_writer：+5%（命令調誤判定が減少）

■ 精度低下・要注意
route_writer：-3%（引用コメント改変が再発）

■ 停滞アラート
rss_collector：2週間精度変化なし
```

---

## 停滞検知ルール

以下のいずれかに該当する場合はリーダーに即時報告する。

```
精度が2週間連続で改善しない
同じミスが3回以上繰り返されている
採用率が50%を下回った状態が2週間継続
改善提案が2週間出ない
```

---

## 改善依頼トリガー

部隊長が整備士に依頼するタイミング：

```
精度が前週比-5%以上低下した場合
同じミスパターンが3件蓄積された場合
採用率が60%を下回った場合
```

---

## 知見のDBテーブル

```sql
-- エージェントの判断ログ
agent_decisions
  id, agent_name, decision_type,
  action, result, reason,
  adopted boolean, timestamp

-- 精度の週次サマリー
agent_precision_log
  id, agent_name, week,
  total_decisions, adopted_count,
  precision_rate, change_from_last_week,
  top_mistake, timestamp

-- 知見のインデックス
skills_knowledge_log
  id, file, pattern, knowledge,
  source_agent, adopted_at, effect
```
