import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; // Ensure prisma client is imported
const { spawn } = require('child_process');

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const managementNo = searchParams.get('managementNo');
        const webVendorName = searchParams.get('vendorName');

        if (!managementNo) {
            return NextResponse.json({ error: 'Management No is required' }, { status: 400 });
        }

        if (!webVendorName) {
            return NextResponse.json({ error: 'Vendor Name is required for authorization' }, { status: 401 });
        }

        // Validate Vendor and get Access Company Name
        // Fetch the vendor from the database to find the linked Access Company Name
        const vendor = await prisma.vendor.findFirst({
            where: { name: webVendorName },
            select: { accessCompanyName: true } // Only fetch the field we need
        });

        const accessVendorKeyword = vendor?.accessCompanyName;

        if (!accessVendorKeyword) {
            return NextResponse.json({
                error: 'Access DB search is not authorized for this vendor.',
                debug: `Vendor '${webVendorName}' has no linked Access Company Name. Please contact admin.`
            }, { status: 403 });
        }

        const dbPath = process.env.ACCESS_DB_PATH || 'C:\\AccessData\\作業管理・２０１１年７月以降.accdb';

        // PowerShell Script Template (Safe for Japanese characters via Base64)
        // Filter by Mapped Vendor Keyword
        // Note: Access OLEDB typically uses '%' for wildcards in ANSI-92 mode, but sometimes '*' in ANSI-89.
        // However, when passed via parameterized query from external OLEDB driver, '%' is standard.
        // If exact match is desired, remove '%' below. Currently mimicking "LIKE %Keyword%" behavior.
        const psScript = `
$DbPath = "${dbPath}"
$ManagementNo = "${managementNo}"
$VendorKeyword = "${accessVendorKeyword}"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

try {
    $connString = "Provider=Microsoft.ACE.OLEDB.12.0;Data Source=$DbPath;Persist Security Info=False;"
    $conn = New-Object System.Data.OleDb.OleDbConnection($connString)
    $conn.Open()

    $cmd = $conn.CreateCommand()
    
    # Base Query
    $sql = @"
        SELECT TOP 1
            A.管理No,
            A.顧客名,
            B.会社名 AS SubContractor,
            C.会社名 AS PrimeContractor,
            A.[22kw], A.[25kw], A.[28kw], A.[36kw], A.[40kw]
        FROM
            (元請台帳テーブル AS C
            INNER JOIN プラスカンパニー工事管理テーブル AS A ON C.受注元ID = A.受注元ID)
            INNER JOIN 下請台帳テーブル AS B ON A.発注先ID = B.発注先ID
        WHERE A.管理No = ?
"@

    # Add Vendor Filter (Using mapped keyword from DB)
    if (-not [string]::IsNullOrEmpty($VendorKeyword)) {
        $sql += " AND (B.会社名 LIKE ? OR C.会社名 LIKE ?)"
    }

    $cmd.CommandText = $sql
    
    # Parameters must be added in Order!
    $p = $cmd.Parameters.Add("?", [System.Data.OleDb.OleDbType]::VarWChar)
    $p.Value = $ManagementNo

    if (-not [string]::IsNullOrEmpty($VendorKeyword)) {
        $p2 = $cmd.Parameters.Add("?", [System.Data.OleDb.OleDbType]::VarWChar)
        $p2.Value = "%$VendorKeyword%"
        $p3 = $cmd.Parameters.Add("?", [System.Data.OleDb.OleDbType]::VarWChar)
        $p3.Value = "%$VendorKeyword%"
    }

    $reader = $cmd.ExecuteReader()
    $result = @{}
    
    if ($reader.Read()) {
        $result["管理No"] = $reader["管理No"]
        $result["顧客名"] = $reader["顧客名"]
        $result["SubContractor"] = $reader["SubContractor"]
        $result["PrimeContractor"] = $reader["PrimeContractor"]
        $result["22kw"] = $reader["22kw"]
        $result["25kw"] = $reader["25kw"]
        $result["28kw"] = $reader["28kw"]
        $result["36kw"] = $reader["36kw"]
        $result["40kw"] = $reader["40kw"]
        # Debug info for verification
        $result["matchedKeyword"] = $VendorKeyword
    } else {
        $result["error"] = "Not found"
    }

    $conn.Close()
    $result | ConvertTo-Json -Compress
} catch {
    Write-Output "ERROR: $($_.Exception.Message)"
    exit 1
}
`;

        // Execute PowerShell using Base64 EncodedCommand to avoid file encoding mojibake issues
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
                if (code !== 0 && !stdout) { // Only reject if no stdout (PowerShell might write errors to stderr but still output valid JSON)
                    reject(new Error(stderr || 'Unknown PowerShell Error'));
                } else {
                    resolve(stdout);
                }
            });
        });

        // Parse output
        // PowerShell might output some noise, find the JSON object part
        const jsonMatch = output.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error("Invalid output format from PowerShell: " + output);
        }

        const data = JSON.parse(jsonMatch[0]);

        if (data.error) {
            return NextResponse.json({ error: 'Not found', data: null }, { status: 404 });
        }

        return NextResponse.json({ success: true, data });

    } catch (error: any) {
        console.error('Access DB Error:', error);
        return NextResponse.json({
            error: 'Database connection failed',
            details: error.message
        }, { status: 500 });
    }
}
