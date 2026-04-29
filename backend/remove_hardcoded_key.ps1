# PowerShell脚本删除硬编码AI key
$file = "start_quant_backend_repaired.py"
$content = Get-Content $file -Encoding UTF8

$found = $false
for ($i = 0; $i -lt $content.Count; $i++) {
    if ($content[$i] -match "'apiKey': 'sk-") {
        Write-Host "Found hardcoded apiKey at line: $($i+1)"
        $content[$i] = "    'apiKey': '',  # 用户必须配置，无硬编码默认值"
        $found = $true
        break
    }
}

if ($found) {
    Set-Content $file $content -Encoding UTF8
    Write-Host "Hardcoded apiKey removed"
} else {
    Write-Host "No hardcoded apiKey found"
}