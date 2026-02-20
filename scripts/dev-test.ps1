# テスト用開発サーバー起動スクリプト
# 本番DBをコピーしてテストDBで開発サーバーを起動します
# 使い方: .\scripts\dev-test.ps1

param(
    [switch]$SkipCopy  # -SkipCopy を付けるとDBコピーをスキップ（前回のテストデータを引き続き使用）
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$ProdDB = Join-Path $ProjectRoot "dev.db"
$TestDB = Join-Path $ProjectRoot "test-dev.db"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  テスト開発サーバー起動スクリプト" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# 本番DBの存在チェック
if (-not (Test-Path $ProdDB)) {
    Write-Host "❌ 本番DB ($ProdDB) が見つかりません" -ForegroundColor Red
    exit 1
}

# DBコピー
if (-not $SkipCopy) {
    $prodSize = (Get-Item $ProdDB).Length / 1MB
    Write-Host "📋 本番DBをテストDBにコピーします..." -ForegroundColor Yellow
    Write-Host "   本番DB: $ProdDB ($([math]::Round($prodSize, 2)) MB)" -ForegroundColor Gray
    Write-Host "   テストDB: $TestDB" -ForegroundColor Gray
    
    Copy-Item -Path $ProdDB -Destination $TestDB -Force
    
    # WALファイルもあればコピー
    $walFile = "$ProdDB-wal"
    if (Test-Path $walFile) {
        Copy-Item -Path $walFile -Destination "$TestDB-wal" -Force
    }
    $shmFile = "$ProdDB-shm"
    if (Test-Path $shmFile) {
        Copy-Item -Path $shmFile -Destination "$TestDB-shm" -Force
    }
    
    Write-Host "✅ DBコピー完了" -ForegroundColor Green
}
else {
    if (-not (Test-Path $TestDB)) {
        Write-Host "❌ テストDB ($TestDB) が見つかりません。-SkipCopy なしで実行してください" -ForegroundColor Red
        exit 1
    }
    Write-Host "⏭️ DBコピーをスキップ（既存のテストDBを使用）" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🚀 テストDBで開発サーバーを起動します..." -ForegroundColor Green
Write-Host "   DATABASE_URL = file:$TestDB" -ForegroundColor Gray
Write-Host ""
Write-Host "⚠️  注意: このサーバーでの変更は本番DBに影響しません" -ForegroundColor Yellow
Write-Host "📧 メール送信先: y.kojima@plus-company.co.jp に固定（テストモード）" -ForegroundColor Yellow
Write-Host "   テスト完了後、Ctrl+C で終了してください" -ForegroundColor Yellow
Write-Host ""

# テストモード環境変数を設定（メール送信先をテスト用に固定）
$env:DATABASE_URL = "file:$TestDB"
$env:TEST_MODE = "true"
$env:TEST_EMAIL_OVERRIDE = "y.kojima@plus-company.co.jp"

Set-Location $ProjectRoot
npx next dev --port 3001 --webpack

