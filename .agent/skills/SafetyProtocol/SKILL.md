---
description: Ensure data safety by backing up and committing before changes
---

# SafetyProtocol Skill

このスキルは、**データの消失や破壊を防ぐための絶対的な安全ルール**を定義します。
データベース操作、スキーマ変更、大規模なリファクタリングなど、「破壊的な変更」を伴う可能性がある作業の前には、**必ず**この手順を実行してください。

## ⚠️ 鉄の掟 (Iron Rules)

**「変更作業を始める前に、現在の状態を保存せよ」**

作業を開始する前、またはコマンドを実行する前に、以下の自問自答を行ってください：
> 「もしこの操作でデータがきえても、直前の状態に戻せるか？」

Noであれば、直ちに以下の手順を実行してください。

## 安全性確保の手順 (Safety Procedure)

### 1. データベースのバックアップ
Prismaのスキーマ変更(`prisma generate`, `prisma migrate`)や、一括データ操作を行う前は、**必ず**バックアップスクリプトを実行してください。

```powershell
.\scripts\backup_db.ps1 -BackupFolder .\backups
```

### 2. 現状のコミット (Save Point)
作業の区切り、または新しい実験的な変更を試す前には、Gitで現在の状態を保存（コミット）してください。

```bash
git add .
git commit -m "chore: Save point before [作業内容]"
```
※ コミットメッセージは日本語でも構いませんが、緊急避難的な保存の場合は `chore: Save point` と明記すると分かりやすいです。

## 適用場面 (When to Apply)

- `npx prisma generate` / `db push` / `migrate` を実行する前 (**必須**)
- 新しいライブラリをインストールする前
- 複雑なリファクタリングを開始する前
- ユーザーから「修正して」と言われたが、現在の状態が不安定な可能性がある場合

## 復旧手順 (Recovery)

万が一データが消失した場合は、`scripts/restore_db.ps1` (もしあれば) または手動で `backups/` フォルダから最新の `.db` ファイルを `prisma/dev.db` にコピーして復旧させてください。
