# Stock-PWA 自動バックアップスクリプト
# 毎日実行を想定（タスクスケジューラで設定）
# 2ヶ月（60日）分のバックアップを保持

param(
    [string]$SourcePath = "F:\Antigravity\stock-pwa\prisma\dev.db",
    [string]$BackupFolder = "$env:USERPROFILE\OneDrive - 会社名\Backup\stock-pwa",  # OneDrive組織用フォルダに変更してください
    [int]$RetentionDays = 60
)

# ログ出力用
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$dateStr = Get-Date -Format "yyyyMMdd"

Write-Host "[$timestamp] バックアップ開始..."

# バックアップフォルダが存在しない場合は作成
if (-not (Test-Path $BackupFolder)) {
    New-Item -ItemType Directory -Path $BackupFolder -Force | Out-Null
    Write-Host "[$timestamp] バックアップフォルダを作成: $BackupFolder"
}

# ソースファイルの存在確認
if (-not (Test-Path $SourcePath)) {
    Write-Host "[$timestamp] エラー: ソースファイルが見つかりません: $SourcePath" -ForegroundColor Red
    exit 1
}

# バックアップ実行
$backupFileName = "dev_$dateStr.db"
$backupPath = Join-Path $BackupFolder $backupFileName

try {
    Copy-Item $SourcePath $backupPath -Force
    $fileSize = (Get-Item $backupPath).Length / 1KB
    Write-Host "[$timestamp] バックアップ成功: $backupPath ($([math]::Round($fileSize, 2)) KB)" -ForegroundColor Green
}
catch {
    Write-Host "[$timestamp] エラー: バックアップ失敗 - $_" -ForegroundColor Red
    exit 1
}

# 古いバックアップの削除（60日以上前）
$cutoffDate = (Get-Date).AddDays(-$RetentionDays)
$oldFiles = Get-ChildItem "$BackupFolder\dev_*.db" | Where-Object { $_.LastWriteTime -lt $cutoffDate }

if ($oldFiles.Count -gt 0) {
    Write-Host "[$timestamp] 古いバックアップを削除中... ($($oldFiles.Count) ファイル)"
    $oldFiles | ForEach-Object {
        Remove-Item $_.FullName -Force
        Write-Host "  削除: $($_.Name)"
    }
}
else {
    Write-Host "[$timestamp] 削除対象の古いファイルはありません"
}

# 現在のバックアップ状況を表示
$allBackups = Get-ChildItem "$BackupFolder\dev_*.db" | Sort-Object LastWriteTime -Descending
Write-Host ""
Write-Host "=== バックアップ状況 ===" -ForegroundColor Cyan
Write-Host "保存場所: $BackupFolder"
Write-Host "ファイル数: $($allBackups.Count)"
Write-Host "最新: $(if ($allBackups.Count -gt 0) { $allBackups[0].Name } else { 'なし' })"
Write-Host "最古: $(if ($allBackups.Count -gt 0) { $allBackups[-1].Name } else { 'なし' })"
Write-Host ""

Write-Host "[$timestamp] バックアップ完了！" -ForegroundColor Green
