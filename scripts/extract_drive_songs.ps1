$wc = New-Object System.Net.WebClient
$wc.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
$html = $wc.DownloadString("https://drive.google.com/drive/folders/1Ua0XFK8vRad96a56sMuLEfCMOx8SBySh")

# Extract aria-label matches
$matches = [regex]::Matches($html, 'aria-label="([^"]+?\.(?:docx|rtf))')
$rawNames = @()
foreach ($m in $matches) {
    $rawNames += $m.Groups[1].Value
}

$uniqueNames = $rawNames | Sort-Object -Unique
Write-Host "Total unique files in Drive folder: $($uniqueNames.Count)"
$uniqueNames | ForEach-Object { Write-Host $_ }
