$ErrorActionPreference = 'Stop'
$scratch = "C:\Users\SOSDOC~1\AppData\Local\Temp\claude\C--Users-SOS-DOCS\5b10224e-2136-446f-b517-6322272ab222\scratchpad"
$ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"

$queries = @{
  digdoc  = '"digitalização de documentos" (pregão | edital | licitação)'
  gestdoc = '"gestão documental" (pregão | edital | licitação)'
  micro   = '(microfilmagem | "guarda de documentos") (pregão | edital)'
  digpe   = '"digitalização" "pregão eletrônico"'
}

$all = @()
foreach ($k in $queries.Keys) {
  $q = [uri]::EscapeDataString($queries[$k])
  $u = "https://api.queridodiario.ok.org.br/gazettes?querystring=$q&published_since=2026-05-01&size=6&sort_by=relevance&number_of_excerpts=2&excerpt_size=1500"
  $r = Invoke-RestMethod -Uri $u -UserAgent $ua -TimeoutSec 40
  foreach ($g in $r.gazettes) {
    $all += [pscustomobject]@{
      query = $k; cidade = $g.territory_name; uf = $g.state_code; data = $g.date
      txt_url = $g.txt_url; pdf_url = $g.url
      excerpt = (($g.excerpts -join " ||| ") -replace '\s+', ' ')
    }
  }
  Write-Host "$k => $($r.gazettes.Count) hits (total $($r.total_gazettes))"
}
$all | ConvertTo-Json -Depth 4 | Out-File "$scratch\qd_hits.json" -Encoding utf8
Write-Host "Salvo: qd_hits.json ($($all.Count) hits)"

# Baixa o texto integral dos diários únicos e recorta ±2000 chars ao redor
# das ocorrências das palavras-chave (simula o passo "isolar trecho" do pipeline)
$keywords = @('digitaliza', 'gestão documental', 'gestao documental', 'microfilm', 'guarda de documentos')
$seen = @{}
$i = 0
foreach ($h in $all) {
  if ($seen.ContainsKey($h.txt_url)) { continue }
  $seen[$h.txt_url] = $true
  $i++
  if ($i -gt 12) { break }
  try {
    $txt = (Invoke-WebRequest -Uri $h.txt_url -UserAgent $ua -TimeoutSec 60).Content
    if ($txt -is [byte[]]) { $txt = [Text.Encoding]::UTF8.GetString($txt) }
    $low = $txt.ToLower()
    $slices = @()
    foreach ($kw in $keywords) {
      $pos = 0
      while (($pos = $low.IndexOf($kw, $pos)) -ge 0 -and $slices.Count -lt 4) {
        $start = [Math]::Max(0, $pos - 2000)
        $len = [Math]::Min(4000, $txt.Length - $start)
        $slices += ($txt.Substring($start, $len) -replace '\s+', ' ')
        $pos += 5000  # pula para não pegar o mesmo bloco
      }
      if ($slices.Count -ge 4) { break }
    }
    $name = "qd_txt_{0:d2}_{1}_{2}.txt" -f $i, ($h.cidade -replace '[^\w]', ''), $h.uf
    ("FONTE: {0}/{1} {2}`r`nTXT: {3}`r`nTAMANHO TOTAL: {4} chars`r`n`r`n{5}" -f $h.cidade, $h.uf, $h.data, $h.txt_url, $txt.Length, ($slices -join "`r`n`r`n===== PRÓXIMA OCORRÊNCIA =====`r`n`r`n")) | Out-File "$scratch\$name" -Encoding utf8
    Write-Host ("{0} {1}/{2}: {3} chars, {4} recortes" -f $name, $h.cidade, $h.uf, $txt.Length, $slices.Count)
  } catch {
    Write-Host ("ERRO {0}/{1}: {2}" -f $h.cidade, $h.uf, $_.Exception.Message)
  }
}
Write-Host "FIM"
