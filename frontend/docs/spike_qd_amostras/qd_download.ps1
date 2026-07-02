$ErrorActionPreference = 'Stop'
$scratch = "C:\Users\SOSDOC~1\AppData\Local\Temp\claude\C--Users-SOS-DOCS\5b10224e-2136-446f-b517-6322272ab222\scratchpad"
$ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
$all = Get-Content "$scratch\qd_hits.json" -Raw -Encoding UTF8 | ConvertFrom-Json
$keywords = @('digitaliza', 'documental', 'microfilm', 'guarda de documentos')
$seen = @{}
$i = 0
foreach ($h in $all) {
  if ($seen.ContainsKey($h.txt_url)) { continue }
  $seen[$h.txt_url] = $true
  $i++
  if ($i -gt 12) { break }
  try {
    $resp = Invoke-WebRequest -Uri $h.txt_url -UserAgent $ua -TimeoutSec 60 -UseBasicParsing
    $txt = [Text.Encoding]::UTF8.GetString($resp.RawContentStream.ToArray())
    $low = $txt.ToLower()
    $slices = @()
    foreach ($kw in $keywords) {
      $pos = 0
      while (($pos = $low.IndexOf($kw, $pos)) -ge 0 -and $slices.Count -lt 4) {
        $start = [Math]::Max(0, $pos - 2000)
        $len = [Math]::Min(4000, $txt.Length - $start)
        $slices += ($txt.Substring($start, $len) -replace '\s+', ' ')
        $pos += 5000
      }
      if ($slices.Count -ge 4) { break }
    }
    $name = "qd_txt_{0:d2}_{1}_{2}.txt" -f $i, ($h.cidade -replace '[^a-zA-Z]', ''), $h.uf
    $body = "FONTE: {0}/{1} {2}`r`nQUERY: {3}`r`nTXT: {4}`r`nTAMANHO TOTAL: {5} chars`r`n`r`n{6}" -f $h.cidade, $h.uf, $h.data, $h.query, $h.txt_url, $txt.Length, ($slices -join "`r`n`r`n===== PROXIMA OCORRENCIA =====`r`n`r`n")
    [IO.File]::WriteAllText("$scratch\$name", $body, (New-Object Text.UTF8Encoding $true))
    Write-Host ("{0}: {1} chars, {2} recortes" -f $name, $txt.Length, $slices.Count)
  } catch {
    Write-Host ("ERRO {0}: {1}" -f $h.txt_url, $_.Exception.Message)
  }
}
Write-Host "FIM"
