# Stock-PWA データベースバックアップスクリプト
# タスクスケジューラで毎日実行することを推奨

param(
    [string]$ProjectRoot = "F:\Antigravity\stock-pwa",
    [string]$BackupFolder = "C:\Users\Kojima\pluscompany,\pluscompany, - ドキュメント\General\Dev\stock-pwa\バックアップ\db",
    [int]$RetentionDays = 30
)

# 日時フォーマット
$Date = Get-Date -Format "yyyyMMdd_HHmmss"
$SourceDB = Join-Path $ProjectRoot "prisma\dev.db"
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
    Copy-Item $SourceDB $BackupFile -Force
    Write-Host "[$(Get-Date)] バックアップ完了: $BackupFile" -ForegroundColor Green
}
catch {
    Write-Error "バックアップ失敗: $_"
    exit 1
}

# 古いバックアップ削除（RetentionDays日以上前）
$OldFiles = Get-ChildItem $BackupFolder -Filter "dev_*.db" | 
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
