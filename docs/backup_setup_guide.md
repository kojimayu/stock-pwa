# タスクスケジューラ設定手順（バックアップ自動化）

## 1. タスクスケジューラを開く

1. Windowsキー + R を押す
2. `taskschd.msc` と入力してEnter

---

## 2. 新しいタスクを作成

1. 右側の「タスクの作成...」をクリック

### 全般タブ
- **名前**: `Stock-PWA バックアップ`
- **説明**: 毎日SQLiteデータベースをOneDriveにバックアップ
- ✅ 「ユーザーがログオンしているかどうかにかかわらず実行する」を選択
- ✅ 「最上位の特権で実行する」にチェック

### トリガータブ
1. 「新規」をクリック
2. **開始**: 毎日
3. **時刻**: `23:00:00` (業務終了後を推奨)
4. 「OK」をクリック

### 操作タブ
1. 「新規」をクリック
2. **操作**: プログラムの開始
3. **プログラム/スクリプト**: `powershell.exe`
4. **引数の追加**:
   ```
   -ExecutionPolicy Bypass -File "F:\Antigravity\stock-pwa\scripts\backup_db.ps1"
   ```
5. 「OK」をクリック

### 条件タブ
- ❌ 「コンピューターをAC電源で使用している場合のみ...」のチェックを外す

### 設定タブ
- ✅ 「タスクを要求時に実行する」
- ✅ 「スケジュールされた時刻にタスクを開始できなかった場合、すぐにタスクを実行する」

---

## 3. 保存

1. 「OK」をクリック
2. Windowsのパスワードを入力して確認

---

## 4. テスト実行

1. 作成したタスクを右クリック
2. 「実行」をクリック
3. OneDriveフォルダにバックアップが作成されたか確認

---

## OneDriveフォルダのパス設定

スクリプト内の `$BackupFolder` を実際のパスに変更してください。

```powershell
# SharePoint (pluscompany,) の場合
$BackupFolder = "C:\Users\Kojima\pluscompany,\pluscompany, - ドキュメント\General\Dev\stock-pwa\バックアップ\db"

# 個人用OneDriveの場合
$BackupFolder = "C:\Users\Kojima\OneDrive\Dev\stock-pwa\バックアップ\db"
```

パスを確認するには、OneDrive/SharePointフォルダをエクスプローラーで開き、アドレスバーをクリックしてください。。
