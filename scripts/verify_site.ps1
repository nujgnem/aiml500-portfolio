param([int]$Port = 4173)
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Python = 'C:\Users\Mengjun\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
$Server = Start-Process -FilePath $Python -ArgumentList '-m','http.server',"$Port",'--bind','127.0.0.1' -WorkingDirectory $Root -WindowStyle Hidden -PassThru
try {
  $Base = "http://127.0.0.1:$Port"
  $Ready = $false
  for ($Attempt = 0; $Attempt -lt 20; $Attempt++) {
    try {
      $Response = Invoke-WebRequest -UseBasicParsing "$Base/"
      if ($Response.StatusCode -eq 200) { $Ready = $true; break }
    } catch {
      Start-Sleep -Milliseconds 250
    }
  }
  if (-not $Ready) { throw 'Local portfolio server did not become ready.' }
  $Homepage = Invoke-WebRequest -UseBasicParsing "$Base/index.html"
  foreach ($Marker in @('home-signal-field','home-signal-ticker','home-title-line','scripts/home-signal-field.mjs')) {
    if ($Homepage.Content -notlike "*$Marker*") { throw "Homepage is missing marker: $Marker" }
  }
  $Paths = @('/','/index.html','/work.html','/about.html','/styles.css','/scripts/site.js','/scripts/home-signal-field.mjs','/scripts/home-signal-control-panel.mjs','/projects/ai-ml-timeline.html','/projects/ml-vs-deep-learning.html','/projects/generative-prompt-sensei.html','/projects/product-team-bias.html','/projects/ai-image-detection-validation.html','/assets/fonts/Archivo-VariableFont_wdth,wght.woff2','/assets/images/timeline-work-wide.webp','/assets/images/timeline-poster.webp','/ai-ml-timeline.png')
  foreach ($Path in $Paths) {
    $Response = Invoke-WebRequest -UseBasicParsing "$Base$Path"
    if ($Response.StatusCode -ne 200) { throw "$Path returned $($Response.StatusCode)" }
    Write-Host "PASS $Path"
  }
} finally {
  if ($Server -and -not $Server.HasExited) {
    Stop-Process -Id $Server.Id -Force
    $Server.WaitForExit()
  }
}

