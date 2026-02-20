# Stock-PWA データベースバックアップスクリプト
# タスクスケジューラで毎日実行することを推奨

param(
    [string]$ProjectRoot = "F:\Antigravity\stock-pwa",
    [string]$BackupFolder = "C:\Users\Kojima\pluscompany,\pluscompany, - ドキュメント\General\Dev\stock-pwa\バックアップ\db",
    [int]$RetentionDays = 30
)

# 日時フォーマット
$Date = Get-Date -Format "yyyyMMdd_HHmmss"

# .env から DATABASE_URL を動的に取得
$EnvFile = Join-Path $ProjectRoot ".env"
$DatabaseUrl = $null
if (Test-Path $EnvFile) {
    $EnvContent = Get-Content $EnvFile | Where-Object { $_ -match '^DATABASE_URL=' }
    if ($EnvContent) {
        # DATABASE_URL="file:./dev.db" or "file:F:/path/to/dev.db" の形式をパース
        $DatabaseUrl = ($EnvContent -replace '^DATABASE_URL=["'']?', '' -replace '["'']?$', '')
    }
}

if ($DatabaseUrl -and $DatabaseUrl -match '^file:(.+)$') {
    $DbRelPath = $Matches[1]
    if ([System.IO.Path]::IsPathRooted($DbRelPath)) {
        # 絶対パス (例: file:F:/Antigravity/stock-pwa/dev.db)
        $SourceDB = $DbRelPath
    } else {
        # 相対パス (例: file:./dev.db)
        $DbRelPath = $DbRelPath -replace '^\./', ''
        $SourceDB = Join-Path $ProjectRoot $DbRelPath
    }
    Write-Host "[$(Get-Date)] .env から取得: DATABASE_URL=$DatabaseUrl" -ForegroundColor Cyan
    Write-Host "[$(Get-Date)] バックアップ対象: $SourceDB" -ForegroundColor Cyan
} else {
    # フォールバック: デフォルトパス
    $SourceDB = Join-Path $ProjectRoot "dev.db"
    Write-Host "[$(Get-Date)] WARNING: .env から DATABASE_URL を取得できませんでした。デフォルトパスを使用します: $SourceDB" -ForegroundColor Yellow
}
$BackupFile = Join-Path $BackupFolder "dev_$Date.db"

# ソースファイル存在確認
if (!(Test-Path $SourceDB)) {
    Write-Error "データベースが見つかりません: $SourceDB"
    exit 1
}

# バックアップフォルダ存在確認・作成
if (!(Test-Path $BackupFolder)) {
    New-Item -ItemType Directory -Path $BackupFolder -Force | Out-Null
}

# バックアップ実行
try {
    # .db ファイルコピー
    Copy-Item $SourceDB $BackupFile -Force
    Write-Host "[$(Get-Date)] DB本体バックアップ完了: $BackupFile" -ForegroundColor Green

    # WALファイル (.db-wal) のコピー
    $SourceWal = "$SourceDB-wal"
    if (Test-Path $SourceWal) {
        $BackupWal = "$BackupFile-wal"
        Copy-Item $SourceWal $BackupWal -Force
        Write-Host "[$(Get-Date)] WALファイルバックアップ完了: $BackupWal" -ForegroundColor Green
    }

    # SHMファイル (.db-shm) のコピー
    $SourceShm = "$SourceDB-shm"
    if (Test-Path $SourceShm) {
        $BackupShm = "$BackupFile-shm"
        Copy-Item $SourceShm $BackupShm -Force
        Write-Host "[$(Get-Date)] SHMファイルバックアップ完了: $BackupShm" -ForegroundColor Green
    }
}
catch {
    Write-Error "バックアップ失敗: $_"
    exit 1
}

# 古いバックアップ削除（RetentionDays日以上前）
# .db, .db-wal, .db-shm を対象にする
$OldFiles = Get-ChildItem $BackupFolder -Include "dev_*.db", "dev_*.db-wal", "dev_*.db-shm" -Recurse | 
Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$RetentionDays) }

if ($OldFiles.Count -gt 0) {
    $OldFiles | Remove-Item -Force
    Write-Host "[$(Get-Date)] 古いバックアップを削除: $($OldFiles.Count) 件" -ForegroundColor Yellow
}

# ========================================
# 設定ファイル(.env)の差分バックアップ
# ========================================
$ConfigFolder = Join-Path (Split-Path $BackupFolder -Parent) "config"
$SourceEnv = Join-Path $ProjectRoot ".env"
$LatestEnvBackup = Get-ChildItem $ConfigFolder -Filter "env_*.txt" -ErrorAction SilentlyContinue | 
Sort-Object LastWriteTime -Descending | 
Select-Object -First 1

if (Test-Path $SourceEnv) {
    $NeedBackup = $true
    
    # 差分チェック: 最新バックアップとハッシュ比較
    if ($LatestEnvBackup) {
        $SourceHash = (Get-FileHash $SourceEnv -Algorithm MD5).Hash
        $BackupHash = (Get-FileHash $LatestEnvBackup.FullName -Algorithm MD5).Hash
        if ($SourceHash -eq $BackupHash) {
            $NeedBackup = $false
            Write-Host "[$(Get-Date)] .env: 変更なし (スキップ)" -ForegroundColor Gray
        }
    }
    
    if ($NeedBackup) {
        if (!(Test-Path $ConfigFolder)) {
            New-Item -ItemType Directory -Path $ConfigFolder -Force | Out-Null
        }
        $EnvBackupFile = Join-Path $ConfigFolder "env_$Date.txt"
        Copy-Item $SourceEnv $EnvBackupFile -Force
        Write-Host "[$(Get-Date)] .env バックアップ: $EnvBackupFile" -ForegroundColor Green
    }
}

Write-Host "[$(Get-Date)] 処理完了" -ForegroundColor Cyan
