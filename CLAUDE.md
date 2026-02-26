# CLAUDE.md（桃鉄風双六ゲーム）

## 概要

桃太郎電鉄にインスパイアされた双六ボードゲームの開発プロジェクト。
このドキュメントは開発を進めるうえで遵守すべき標準ルールを定義します。

---

## ⚠️ セッション開始時の必須確認

新しいセッションを開始する際は、必ず以下を実施してください：

```bash
pwd
ls -la
find . -maxdepth 3 -type d | sort
find . -name "product-requirements.md" -type f
ls .steering/
```

**目的:**
- 自分がどのディレクトリにいるか把握する
- 永続的ドキュメントの場所を特定する
- 現在の作業状況を把握する

---

## プロジェクト構造

```
20260225-sugoroku-game/
├── CLAUDE.md
├── docs/
│   ├── product-requirements.md
│   ├── functional-design.md
│   ├── architecture.md
│   ├── repository-structure.md
│   ├── development-guidelines.md
│   └── glossary.md
├── .steering/
│   └── 20260225-initial-implementation/
│       ├── requirements.md
│       ├── design.md
│       └── tasklist.md
└── src/
```

---

## ゲーム固有の確定仕様

| 要素 | 内容 |
|------|------|
| プラットフォーム | Webブラウザ（PC専用） |
| プレイ人数 | 最大4人（CPU対戦 + ホットシート） |
| マップ | 日本全国・実在地名・約50〜60都市 |
| 路線 | 新幹線・在来線・フェリー |
| ゲームルール | 桃鉄ルールを完全踏襲 |
| 技術スタック | Phaser.js + TypeScript + Vite |

---

## コード品質の原則

- `src/game/` にPhaser.jsをインポートしない
- `src/scenes/` にゲームロジックを書かない
- `localStorage` は `LocalStorageSaveManager` 以外で呼ばない
- ゲームデータはJSONで管理（コードにハードコードしない）

---

## フェーズ完了チェックリスト

- [ ] コードレビュー実施（サブエージェント）
- [ ] 必須修正事項ゼロ確認
- [ ] `.steering/[作業]/tasklist.md` 更新
- [ ] コミット＆プッシュ

---

## 変更履歴

- 2026-02-25: 初版作成
