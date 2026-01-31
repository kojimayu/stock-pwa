const { spawn } = require('child_process');

// Configuration
const DB_PATH = "C:\\AccessData\\作業管理・２０１１年７月以降.accdb";
const MANAGEMENT_NO = "112880";

// PowerShell Script Content
// Note: We use Japanese column names like "顧客名" which caused issues before.
const psScript = `
$DbPath = "${DB_PATH}"
$ManagementNo = "${MANAGEMENT_NO}"

# Ensure output is UTF8 for Node.js to capture
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

try {
    $connString = "Provider=Microsoft.ACE.OLEDB.12.0;Data Source=$DbPath;Persist Security Info=False;"
    $conn = New-Object System.Data.OleDb.OleDbConnection($connString)
    $conn.Open()

    $cmd = $conn.CreateCommand()
    $cmd.CommandText = @"
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
    
    $p = $cmd.Parameters.Add("?", [System.Data.OleDb.OleDbType]::VarWChar)
    $p.Value = $ManagementNo

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

console.log("Running Access DB Test (Base64 Mode)...");

// Encode script to Base64 UTF-16LE (Required for PowerShell -EncodedCommand)
const encodedCommand = Buffer.from(psScript, 'utf16le').toString('base64');

// Spawn PowerShell with EncodedCommand
const ps = spawn('powershell', ['-EncodedCommand', encodedCommand], {
    stdio: ['ignore', 'inherit', 'inherit']
});

ps.on('close', (code) => {
    console.log(`\nProcess exited with code ${code}`);
});
