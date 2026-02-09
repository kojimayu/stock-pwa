---
description: Git operations (commit, push, etc) following project rules
---

# GitOperator Skill

このスキルは、プロジェクト内でのGit操作を行う際の手順とルールを定義します。

## ⚠️ 重要ルール (Critical Rules)

1. **言語**: コミットメッセージは**必ず日本語**で記述してください。
   - ❌ `feat: Add login page`
   - ✅ `feat: ログインページの実装`

2. **フォーマット**: Conventional Commits に従ってください。
   - `feat`: 新機能
   - `fix`: バグ修正
   - `docs`: ドキュメントのみの変更
   - `style`: コードの動作に影響しない変更（スペース、フォーマットなど）
   - `refactor`: バグ修正や機能追加を含まないコードの変更
   - `perf`: パフォーマンスを向上させるコードの変更
   - `test`: テストの追加や修正
   - `chore`: ビルドプロセスやツールの変更

## 手順 (Procedure)

1. **Status 確認**
   - 変更ファイルを確認します。
   ```bash
   git status
   ```

2. **Add**
   - 意図したファイルのみをステージングします。
   ```bash
   git add .
   # または特定のファイル
   git add path/to/file
   ```

3. **Commit**
   - **日本語**で、変更内容がわかるメッセージを作成します。
   ```bash
   git commit -m "type: 変更内容の要約"
   ```

4. **Push (必要な場合)**
   - リモートにプッシュします。
   ```bash
   git push
   ```
