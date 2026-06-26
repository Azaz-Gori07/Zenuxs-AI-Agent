$path = 'D:\V3\zenuxs-code\packages\agents\src\agent-graph.ts'
$lines = Get-Content $path
$cleaned = @()
$skipNextBlank = $false
foreach ($line in $lines) {
    if ($line -match '^__AGENT_GRAPH_TS_END__$|^__FINAL_MARKER__$') {
        $skipNextBlank = $true
        continue
    }
    if ($skipNextBlank -and $line -match '^\s*$') {
        $skipNextBlank = $false
        continue
    }
    $skipNextBlank = $false
    $cleaned += $line
}
Set-Content $path -Value $cleaned -NoNewline
