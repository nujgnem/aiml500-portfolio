$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
function Assert-True([bool]$Condition, [string]$Message) { if (-not $Condition) { throw $Message } }
function Read-Page([string]$RelativePath) {
  $Path = Join-Path $Root $RelativePath
  Assert-True (Test-Path $Path) "Missing public page: $RelativePath"
  Get-Content -Raw -Encoding UTF8 $Path
}

$Protected = @{
  'ai-ml-timeline.png' = '1F2391EC9239C0D336D3C48C6888A86F40A7C064FCDE40944B74EE2D9EB4DE56'
}
foreach ($Item in $Protected.GetEnumerator()) {
  Assert-True ((Get-FileHash (Join-Path $Root $Item.Key) -Algorithm SHA256).Hash -eq $Item.Value) "Protected source changed: $($Item.Key)"
}
$Homepage = Read-Page 'index.html'; $Work = Read-Page 'work.html'; $About = Read-Page 'about.html'; $Case = Read-Page 'projects/ai-ml-timeline.html'
Assert-True ($Homepage -match 'AI &amp; ML Portfolio') 'Homepage identity line is missing.'
Assert-True ($Homepage -match 'A portfolio of research, visual systems, and experiments in artificial intelligence and machine learning\.') 'Homepage portfolio statement is missing.'
Assert-True ($Homepage -notmatch 'timeline-home-detail\.webp|class="home-media"|View Work|<a href="about\.html">About</a>') 'Homepage still contains project preview or CTA links.'
Assert-True ([regex]::Matches($Homepage, '<h1\b').Count -eq 1) 'Homepage must have exactly one H1.'
Assert-True ($Homepage -match '<h1[^>]*id="home-title"[^>]*>' -and $Homepage -notmatch '<h1[^>]*aria-hidden') 'Homepage H1 must expose the title to assistive technology.'
Assert-True ([regex]::Matches($Homepage, 'class="home-title-line"').Count -eq 2 -and $Homepage -match 'class="home-title-line">Mengjun</span>' -and $Homepage -match 'class="home-title-line">Duan</span>') 'Homepage title must use the approved two-line title spans.'
Assert-True ($Homepage -match '<canvas class="home-signal-field" aria-hidden="true"') 'Homepage signal canvas is missing or exposed to assistive technology.'
Assert-True ($Homepage -match 'class="home-signal-ticker" aria-hidden="true"') 'Homepage signal ticker is missing or exposed to assistive technology.'
Assert-True ($Homepage -notmatch 'home-text-safe-zone|home-marquee') 'Homepage still contains legacy safe-zone or marquee markup.'
Assert-True ($Homepage -notmatch 'home-signal-lab|home-signal-control-panel\.mjs') 'SIGNAL LAB must be dynamically local-only, not homepage markup.'
Assert-True ($Work -match 'Selected Work' -and $Work -match 'projects/ai-ml-timeline.html' -and $Work -match 'projects/ml-vs-deep-learning.html') 'Work-page project links are missing.'
$AboutStatements = @(
  "I'm a Creative Technologist interested in what happens when AI and machine learning leave the diagram and enter people's lives. A model starts with data, rules, and probabilities. Then it becomes an image tool, an interface, a recommendation, or a decision that affects someone else. That transition is where I like to work.",
  'I use research, visual thinking, and prototypes to make technical ideas easier to see and question. My work moves between AI/ML foundations, generative tools, automation, and interactive media. I pay attention to the choices a system carries: the data behind it, the assumptions built into it, what it makes visible, and when a person needs to step in.',
  'This portfolio includes AIML-500 work alongside my broader creative-technology practice. I want to make AI legible enough for people to respond to it.'
)
$AboutPracticeValues = @(
  'AI/ML systems, generative tools, and interactive experiences',
  'Research, creative direction, visual storytelling, and prototyping',
  'AI/ML workflows, HTML/CSS, structured content, and image-making tools'
)
Assert-True ($About -match [regex]::Escape('Creative systems, made visible.')) 'About-page heading is missing.'
foreach ($Statement in $AboutStatements) {
  Assert-True ($About -match [regex]::Escape($Statement)) 'An approved About statement is missing.'
}
foreach ($Value in $AboutPracticeValues) {
  Assert-True ($About -match [regex]::Escape($Value)) 'An approved About practice-index value is missing.'
}
$AboutStatement = [regex]::Match($About, '<section class="about-statement page-grid"[\s\S]*?</section>').Value
Assert-True ($AboutStatement.Length -gt 0) 'About statement wrapper is missing.'
Assert-True ([regex]::Matches($AboutStatement, '<p>').Count -eq 3) 'About statement must contain exactly three paragraphs.'
Assert-True ($About -notmatch '<dt>\s*Course\s*</dt>' -and $About -notmatch 'Contact|Email|LinkedIn|Resume') 'About page contains a Course field or contact placeholder.'
Assert-True ($Case -match 'View full timeline' -and $Case -match 'AI assistance supported drafting and organization') 'Case-study evidence is missing.'
foreach ($Page in @($Homepage, $Work, $About, $Case)) {
  Assert-True ($Page -match 'scripts/site.js') 'A public page does not load shared enhancement.'
  Assert-True ($Page -match 'href="index.html"|href="../index.html"') 'A public page lacks a wordmark route to Home.'
  Assert-True ($Page -match 'class="skip-link" href="#main-content"') 'A public page lacks a skip link to main content.'
  Assert-True ($Page -match '<main[^>]+id="main-content"') 'A public page lacks a main-content target.'
}
Assert-True ($Case -match 'data-nav-page="work.html ai-ml-timeline.html"') 'Case-study Work navigation does not declare its current route.'
Assert-True ($Work -match 'timeline-work-wide.webp" alt="Wide detail from the AI and machine learning timeline" width="1600" height="900" loading="lazy"') 'Work media lacks stable lazy-loaded dimensions.'
Assert-True ($Case -match 'timeline-poster.webp" alt="Full radial timeline of AI and machine learning milestones from 1950 through 2026" width="1000" height="1500" loading="lazy"') 'Case poster lacks stable lazy-loaded dimensions.'
foreach ($Asset in @('assets/fonts/Archivo-VariableFont_wdth,wght.woff2','assets/images/timeline-work-wide.webp','assets/images/timeline-poster.webp')) {
  Assert-True (Test-Path (Join-Path $Root $Asset)) "Missing redesign asset: $Asset"
}
$Css = Get-Content -Raw -Encoding UTF8 (Join-Path $Root 'styles.css')
Assert-True ($Css -match '#F4F3EF' -and $Css -match '#090909' -and $Css -match '#FF3B14') 'Color tokens are missing.'
Assert-True ($Css -match '@font-face' -and $Css -match 'Archivo-VariableFont_wdth,wght.woff2') 'Self-hosted Archivo is missing.'
Assert-True ($Css -notmatch 'Georgia|Times New Roman|background-size:\s*48px') 'Legacy typography or grid remains.'
Assert-True ($Css -match '\.skip-link' -and $Css -match '\.skip-link:focus') 'Skip-link focus styling is missing.'
Assert-True ($Css -match '\.site-nav \{[\s\S]*font-size:\s*0\.8125rem') 'Primary navigation is not in the approved 13px range.'
Assert-True ($Css -match '\.site-nav a\[aria-current="page"\] \{ color: var\(--ink\); \}') 'Light-header active navigation text lacks accessible contrast.'
Assert-True ($Css -match '\.work-card-media img \{[\s\S]*aspect-ratio:\s*16 / 9') 'Work image aspect ratio is missing.'
Assert-True ($Css -match '\.poster-image \{[\s\S]*aspect-ratio:\s*2 / 3') 'Poster image aspect ratio is missing.'
foreach ($Variable in @('--signal-cell-desktop:\s*44px', '--signal-cell-narrow:\s*54px', '--signal-outer-density:\s*\.14', '--signal-title-density:\s*\.78', '--signal-copy-clearance:\s*1\.25')) {
  Assert-True ($Css -match $Variable) "Missing homepage signal variable: $Variable"
}
Assert-True ($Css -match '\.home-signal-field[\s\S]*pointer-events:\s*none') 'Signal canvas must not receive pointer events.'
Assert-True ($Css -match '\.home-page \.home-hero\s*\{[\s\S]*min-height:\s*calc\(100svh - 4\.5rem\)[\s\S]*padding:\s*0') 'Homepage hero must fill the viewport beneath the fixed header.'
Assert-True ($Css -match '\.home-page \.home-signal-field\s*\{[\s\S]*inset:\s*0[;}]') 'Homepage signal canvas must cover the full hero.'
Assert-True ($Css -match '\.home-page \.home-signal-field\s*\{[\s\S]*width:\s*100%[;}]' -and $Css -match '\.home-page \.home-signal-field\s*\{[\s\S]*height:\s*100%[;}]') 'Homepage signal canvas must size to the full hero.'
Assert-True ($Css -notmatch 'home-text-safe-zone|home-marquee') 'Legacy safe-zone or marquee styling remains.'
Assert-True ($Css -notmatch '\.home-page \.home-hero::before') 'Homepage crosshair must not be permanently rendered in CSS.'
Assert-True ($Css -match '\.home-page \.home-title\s*\{[\s\S]*z-index:\s*2' -and $Css -match '\.home-page \.home-signal-ticker\s*\{[\s\S]*z-index:\s*3') 'Homepage title and ticker layers are not ordered.'
Assert-True ($Css -match '\[data-signal-ready="true"\] \.home-title\s*\{[\s\S]*-webkit-text-fill-color:\s*transparent[\s\S]*-webkit-text-stroke:\s*1px var\(--ink\)') 'Signal-ready title stroke styling is missing.'
Assert-True ($Css -match '\.home-page \.home-signal-ticker\s*\{[\s\S]*color:\s*var\(--signal\)[\s\S]*text-transform:\s*uppercase') 'Homepage ticker must be thin, uppercase, and signal colored.'
Assert-True ($Css -match '\[data-signal-ready="true"\] \.home-signal-ticker span\s*\{[\s\S]*animation:\s*home-signal-ticker-scroll' -and $Css -match '@keyframes home-signal-ticker-scroll') 'Homepage ticker must move continuously only after signal rendering is ready.'
Assert-True ($Css -match 'not\(\[data-signal-ready="true"\]\) \.home-signal-ticker span\s*\{[\s\S]*animation:\s*none') 'Fallback ticker must remain visible and static.'
Assert-True ($Css -match '\.home-page \.home-identity[\s\S]*color:\s*var\(--signal\)') 'Homepage identity must use the signal token.'
Assert-True ($Css -match '\.site-footer\s*\{[^}]*padding-block:\s*0\.75rem') 'Footer padding is not reduced globally.'
Assert-True ($Css -match '\.site-footer \.page-grid > p\s*\{[^}]*grid-column:\s*1 / -1') 'Footer credit is not allowed to use the full grid width.'
Assert-True ($Css -notmatch '@media \(prefers-reduced-motion: reduce\)[\s\S]*\.home-signal-ticker\s*\{\s*display:\s*none') 'Reduced-motion ticker must remain visible.'
Assert-True ($Css -match '@media \(prefers-reduced-motion: reduce\)[\s\S]*\.home-signal-ticker span\s*\{[\s\S]*animation:\s*none !important' -and $Css -match '@media \(prefers-reduced-motion: reduce\)[\s\S]*transition:\s*none') 'Reduced-motion ticker must be static and transitions reset.'
$ReducedMotionCss = [regex]::Match($Css, '@media \(prefers-reduced-motion: reduce\)[\s\S]*$').Value
Assert-True ($ReducedMotionCss -match '\.home-page \.home-hero' -and $ReducedMotionCss -notmatch '(?m)^\s*\*,\s*$') 'Reduced-motion reset must stay scoped to .home-page.'
$Script = Get-Content -Raw -Encoding UTF8 (Join-Path $Root 'scripts/site.js')
$SiteJs = Get-Content -Raw -Encoding UTF8 (Join-Path $Root 'scripts/site.js')
Assert-True ($Script -match 'IntersectionObserver' -and $Script -match 'prefers-reduced-motion') 'Motion fallback is missing.'
Assert-True ($Script -match 'split\(/\\s\+/\)' -and $Script -match 'includes\(current\)') 'Navigation route aliases are unsupported.'
$SignalScript = Get-Content -Raw -Encoding UTF8 (Join-Path $Root 'scripts/home-signal-field.mjs')
$SignalPanel = Join-Path $Root 'scripts/home-signal-control-panel.mjs'
$SignalCore = Get-Content -Raw -Encoding UTF8 (Join-Path $Root 'scripts/home-signal-field-core.mjs')
Assert-True (Test-Path $SignalPanel) 'Local SIGNAL LAB module is missing.'
Assert-True ($SignalScript -match 'if \(isLocalSignalHost\(window\.location\.hostname\)\) \{[\s\S]*?import\("\.\/home-signal-control-panel\.mjs"\)') 'SIGNAL LAB must load through a local-host dynamic import.'
Assert-True ($SignalScript -notmatch 'from "\.\/home-signal-control-panel\.mjs"') 'SIGNAL LAB must not use a production static import.'
Assert-True ($SignalCore -match 'const MAX_SIGNAL_CELLS = 6400;' -and $SignalCore -match 'cells > 5000 \? 8 : cells > 3200 \? 10 : 12') 'ASCII grid budget or capped cadence contract is missing.'
Assert-True ($SignalScript -match 'const frameInterval = 1000 / state\.renderPlan\.scheduledFps;') 'ASCII renderer must use its capped planned cadence.'
Assert-True ($SignalScript -match 'motionQuery\.matches \|\| narrowQuery\.matches' -and $SignalScript -match 'if \(!motionQuery\.matches && !narrowQuery\.matches\) startLoop\(\);') 'Narrow and reduced-motion rendering must remain static.'
Assert-True ($SignalScript -match 'if \(!context \|\| !maskContext\) \{[\s\S]*?canvas\.hidden = true;[\s\S]*?canvas\.dataset\.signalState = "fallback";[\s\S]*?return;' -and $SignalScript -match 'state\.fallback = true;') 'Canvas or mask failure must leave the native-text fallback active.'
Assert-True ($SignalScript -match 'const verticalHalfLength = Math\.min\(72, bounds\.height \* 0\.1\);' -and $SignalScript -match 'context\.lineTo\(x, Math\.min\(bounds\.height, y \+ verticalHalfLength\)\);') 'Renderer scan crosshair must use a short vertical segment.'
Write-Host 'PASS redesign contract'

