param (
    [string]$DbPath,
    [string]$ManagementNo
)

# Output encoding to UTF8 for JSON
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

try {
    if (-not (Test-Path $DbPath)) {
        throw "Database file not found: $DbPath"
    }

    $connString = "Provider=Microsoft.ACE.OLEDB.12.0;Data Source=$DbPath;Persist Security Info=False;"
    $conn = New-Object System.Data.OleDb.OleDbConnection($connString)
    $conn.Open()

    $cmd = $conn.CreateCommand()
    
    # Query matching implementation plan
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
    
    # Add Parameter
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
    }
    else {
        $result["error"] = "Not found"
    }

    $conn.Close()

    # Output JSON
    $result | ConvertTo-Json -Compress

}
catch {
    $err = @{ 
        error = $_.Exception.Message 
        trace = $_.ScriptStackTrace
    }
    $err | ConvertTo-Json -Compress
    exit 1
}
