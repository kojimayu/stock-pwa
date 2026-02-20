import fs from "fs";
import path from "path";

export default async function UpdateHistoryPage() {
    // CHANGELOG.mdを読み込み
    const changelogPath = path.join(process.cwd(), "docs", "CHANGELOG.md");
    let content = "";
    try {
        content = fs.readFileSync(changelogPath, "utf-8");
    } catch {
        content = "# 更新履歴\n\n更新履歴ファイルが見つかりません。";
    }

    // シンプルなMarkdown→HTML変換
    const htmlContent = convertChangelogToHtml(content);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">📋 更新履歴</h2>
                <p className="text-muted-foreground">
                    システムの機能追加・変更・修正の記録です。
                </p>
            </div>
            <div
                className="prose prose-sm max-w-none bg-white dark:bg-slate-900 rounded-lg p-6 border"
                dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
        </div>
    );
}

// CHANGELOG用のMarkdown→HTML変換
function convertChangelogToHtml(md: string): string {
    let html = md;

    // 水平線
    html = html.replace(/^---$/gm, '<hr class="my-4" />');

    // 見出し
    html = html.replace(/^### Added$/gm, '<h3 class="text-base font-semibold mt-5 mb-2 text-green-700">✅ 追加</h3>');
    html = html.replace(/^### Changed$/gm, '<h3 class="text-base font-semibold mt-5 mb-2 text-blue-700">🔄 変更</h3>');
    html = html.replace(/^### Fixed$/gm, '<h3 class="text-base font-semibold mt-5 mb-2 text-orange-700">🔧 修正</h3>');
    html = html.replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-5 mb-2">$1</h3>');
    html = html.replace(/^## \[Unreleased\]$/gm, '<h2 class="text-lg font-bold mt-6 mb-3 pb-2 border-b">🚧 開発中</h2>');
    html = html.replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold mt-6 mb-3 pb-2 border-b">$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mb-6">$1</h1>');

    // 太字
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // インラインコード
    html = html.replace(/`([^`]+)`/g, '<code class="bg-slate-100 dark:bg-slate-800 px-1 rounded text-xs">$1</code>');

    // リスト（日付付きエントリ用のスタイル）
    html = html.replace(/^- (.+)$/gm, (_, text) => {
        // 日付パターンを検出してバッジ化
        const dated = text.replace(/\((\d{4}-\d{2}-\d{2})\)/, '<span class="text-xs bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded ml-1">$1</span>');
        return `<li class="ml-5 list-disc mb-2 text-sm leading-relaxed">${dated}</li>`;
    });

    // 段落
    html = html.replace(/\n\n/g, '</p><p class="mb-3">');

    return html;
}
