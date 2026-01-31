import { NextResponse } from 'next/server';
const { spawn } = require('child_process');

export const dynamic = 'force-dynamic';

export async function GET() {
    const dbPath = process.env.ACCESS_DB_PATH || 'C:\\AccessData\\作業管理・２０１１年７月以降.accdb';

    // PowerShell Script to fetch unique company names from SubContractor table (下請台帳テーブル)
    const psScript = `
$DbPath = "${dbPath}"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

try {
    $connString = "Provider=Microsoft.ACE.OLEDB.12.0;Data Source=$DbPath;Persist Security Info=False;"
    $conn = New-Object System.Data.OleDb.OleDbConnection($connString)
    $conn.Open()

    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "SELECT DISTINCT [会社名], [発注先ID] FROM [下請台帳テーブル] WHERE [会社名] IS NOT NULL ORDER BY [会社名]"
    
    $reader = $cmd.ExecuteReader()
    $results = @()
    
    while ($reader.Read()) {
        $row = @{
            name = $reader["会社名"]
            id = $reader["発注先ID"]
        }
        $results += $row
    }

    $conn.Close()
    $results | ConvertTo-Json -Compress
} catch {
    Write-Output "ERROR: $($_.Exception.Message)"
    exit 1
}
`;

    try {
        const encodedCommand = Buffer.from(psScript, 'utf16le').toString('base64');

        const output = await new Promise<string>((resolve, reject) => {
            const ps = spawn('powershell', ['-EncodedCommand', encodedCommand], {
                stdio: ['ignore', 'pipe', 'pipe']
            });

            let stdout = '';
            let stderr = '';

            ps.stdout.on('data', (data) => { stdout += data.toString(); });
            ps.stderr.on('data', (data) => { stderr += data.toString(); });

            ps.on('close', (code) => {
                if (code !== 0 && !stdout) {
                    reject(new Error(stderr || 'Unknown PowerShell Error'));
                } else {
                    resolve(stdout);
                }
            });
        });

        const jsonMatch = output.match(/\[[\s\S]*\]/); // Match detailed array
        // If only one result, it might come as object, or if empty nothing.
        // PowerShell ConvertTo-Json behavior: Single object isn't inside [], list is.
        // If output is simple object, match that too.

        let parsable = output.trim();
        // Try to find JSON-like structure
        const firstBrace = output.indexOf('{');
        const firstBracket = output.indexOf('[');

        if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
            parsable = output.substring(firstBracket);
        } else if (firstBrace !== -1) {
            parsable = output.substring(firstBrace);
            // If single object, wrap in array for consistency
            parsable = `[${parsable}]`;
        } else {
            return NextResponse.json({ success: true, data: [] });
        }

        // Clean up trailing garbage if any
        // Doing a simple parse try
        try {
            const data = JSON.parse(parsable);
            return NextResponse.json({ success: true, data });
        } catch (e) {
            // Fallback: try regex extraction if clean parse fails
            const match = output.match(/\[.*\]|\{.*\}/s);
            if (match) {
                const clean = match[0];
                const data = JSON.parse(clean.startsWith('[') ? clean : `[${clean}]`);
                return NextResponse.json({ success: true, data });
            }
            throw e;
        }

    } catch (error: any) {
        console.error('Access Vendor Fetch Error:', error);
        return NextResponse.json({
            error: 'Failed to fetch vendors',
            details: error.message
        }, { status: 500 });
    }
}
