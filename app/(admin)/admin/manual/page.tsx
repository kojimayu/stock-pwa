import fs from "fs";
import path from "path";

export default async function ManualPage() {
    // マニュアルファイルを読み込み
    const manualPath = path.join(process.cwd(), "docs", "MANUAL_ADMIN.md");
    let content = "";
    try {
        content = fs.readFileSync(manualPath, "utf-8");
    } catch {
        content = "マニュアルファイルが見つかりません。";
    }

    // シンプルなMarkdown→HTML変換（見出し、リスト、テーブル、太字、コード）
    const htmlContent = convertMarkdownToHtml(content);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">📖 管理者マニュアル</h2>
                <p className="text-muted-foreground">
                    在庫管理システムの操作手順です。
                </p>
            </div>
            <div
                className="prose prose-sm max-w-none bg-white dark:bg-slate-900 rounded-lg p-6 border"
                dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
        </div>
    );
}

// シンプルなMarkdown→HTML変換
function convertMarkdownToHtml(md: string): string {
    let html = md;

    // 水平線
    html = html.replace(/^---$/gm, '<hr class="my-6" />');

    // 見出し
    html = html.replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-6 mb-2">$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold mt-8 mb-3 pb-2 border-b">$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mb-4">$1</h1>');

    // 太字
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // インラインコード
    html = html.replace(/`([^`]+)`/g, '<code class="bg-slate-100 dark:bg-slate-800 px-1 rounded text-sm">$1</code>');

    // コードブロック
    html = html.replace(/```[\s\S]*?```/g, (match) => {
        const code = match.replace(/```\w*\n?/, '').replace(/```$/, '');
        return `<pre class="bg-slate-100 dark:bg-slate-800 p-3 rounded my-2 overflow-x-auto"><code>${code}</code></pre>`;
    });

    // テーブル
    html = html.replace(/(\|.+\|[\r\n]+\|[-| :]+\|[\r\n]+((\|.+\|[\r\n]*)+))/gm, (match) => {
        const rows = match.trim().split('\n').filter(r => r.trim());
        if (rows.length < 2) return match;

        const headers = rows[0].split('|').filter(c => c.trim()).map(c => c.trim());
        const dataRows = rows.slice(2); // 2行目はセパレータ

        let table = '<table class="w-full text-sm border-collapse my-4">';
        table += '<thead><tr class="bg-slate-100 dark:bg-slate-800">';
        headers.forEach(h => {
            table += `<th class="p-2 border text-left font-medium">${h}</th>`;
        });
        table += '</tr></thead><tbody>';
        dataRows.forEach(row => {
            const cells = row.split('|').filter(c => c.trim()).map(c => c.trim());
            table += '<tr class="border-b hover:bg-slate-50 dark:hover:bg-slate-800/50">';
            cells.forEach(c => {
                table += `<td class="p-2 border">${c}</td>`;
            });
            table += '</tr>';
        });
        table += '</tbody></table>';
        return table;
    });

    // リスト（番号付き）
    html = html.replace(/^(\d+)\. (.+)$/gm, '<li class="ml-6 list-decimal mb-1">$2</li>');
    // サブリスト
    html = html.replace(/^   - (.+)$/gm, '<li class="ml-10 list-disc mb-1 text-muted-foreground">$1</li>');
    html = html.replace(/^- (.+)$/gm, '<li class="ml-6 list-disc mb-1">$1</li>');

    // 段落（空行で区切る）
    html = html.replace(/\n\n/g, '</p><p class="mb-3">');

    return html;
}
