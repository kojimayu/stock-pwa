import { NextResponse } from 'next/server';
const { spawn } = require('child_process');

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const dbPath = process.env.ACCESS_DB_PATH || 'C:\\AccessData\\作業管理・２０１１年７月以降.accdb';

        // PowerShell Script to fetch vendors from "下請台帳テーブル"
        // Selecting ID and Company Name
        const psScript = `
$DbPath = "${dbPath}"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

try {
    $connString = "Provider=Microsoft.ACE.OLEDB.12.0;Data Source=$DbPath;Persist Security Info=False;"
    $conn = New-Object System.Data.OleDb.OleDbConnection($connString)
    $conn.Open()

    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "SELECT 発注先ID, 会社名 FROM 下請台帳テーブル WHERE 会社名 IS NOT NULL ORDER BY 会社名"
    
    $reader = $cmd.ExecuteReader()
    $results = @()
    
    while ($reader.Read()) {
        $results += @{
            id = $reader["発注先ID"].ToString()
            name = $reader["会社名"]
        }
    }

    $conn.Close()
    
    # Return JSON
    $results | ConvertTo-Json -Compress
} catch {
    Write-Output "ERROR: $($_.Exception.Message)"
    exit 1
}
`;

        // Execute PowerShell using Base64 EncodedCommand
        const encodedCommand = Buffer.from(psScript, 'utf16le').toString('base64');

        const output = await new Promise<string>((resolve, reject) => {
            const ps = spawn('powershell', ['-EncodedCommand', encodedCommand], {
                stdio: ['ignore', 'pipe', 'pipe']
            });

            let stdout = '';
            let stderr = '';

            ps.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
            ps.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

            ps.on('close', (code: number) => {
                if (code !== 0 && !stdout) {
                    reject(new Error(stderr || 'Unknown PowerShell Error'));
                } else {
                    resolve(stdout);
                }
            });
        });

        // Clean up output and parse JSON
        // PowerShell might emit extra newlines or warnings, relying on JSON structure
        const jsonMatch = output.match(/\[[\s\S]*\]/); // Match array

        let data = [];
        if (jsonMatch) {
            data = JSON.parse(jsonMatch[0]);
        } else {
            // If output is emptry or single object, try object match or handle empty result
            const objectMatch = output.match(/\{[\s\S]*\}/);
            if (objectMatch) {
                data = [JSON.parse(objectMatch[0])];
            } else if (output.trim() === "") {
                data = [];
            } else {
                console.warn("Unexpected PowerShell output:", output);
                // Fallback: try parsing the whole thing if it looks like JSON
                try {
                    data = JSON.parse(output);
                    if (!Array.isArray(data)) data = [data]; // Ensure array
                } catch (e) {
                    throw new Error("Failed to parse PowerShell output: " + output);
                }
            }
        }

        return NextResponse.json({ success: true, count: data.length, data });

    } catch (error: any) {
        console.error('Access Vendors Fetch Error:', error);
        return NextResponse.json({
            error: 'Failed to fetch vendors from Access DB',
            details: error.message
        }, { status: 500 });
    }
}
