$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
function Assert-True([bool]$Condition, [string]$Message) { if (-not $Condition) { throw $Message } }
function Read-Page([string]$RelativePath) {
  $Path = Join-Path $Root $RelativePath
  Assert-True (Test-Path $Path) "Missing public page: $RelativePath"
  Get-Content -Raw -Encoding UTF8 $Path
}

$Protected = @{
  'hero-ai-ml-portfolio.png' = '381D27F19F5BF7872230D3C59E178D7295492285EA8A41BD17BAD3A963FD8F8B'
  'ai-ml-timeline.png' = '1F2391EC9239C0D336D3C48C6888A86F40A7C064FCDE40944B74EE2D9EB4DE56'
}
foreach ($Item in $Protected.GetEnumerator()) {
  Assert-True ((Get-FileHash (Join-Path $Root $Item.Key) -Algorithm SHA256).Hash -eq $Item.Value) "Protected source changed: $($Item.Key)"
}
$Homepage = Read-Page 'index.html'; $Work = Read-Page 'work.html'; $About = Read-Page 'about.html'; $Case = Read-Page 'projects/ai-ml-timeline.html'
Assert-True ($Homepage -match 'Creative Technologist / AI &amp; ML Portfolio') 'Homepage identity line is missing.'
Assert-True ($Homepage -match 'A portfolio of research, visual systems, and experiments in artificial intelligence and machine learning\.') 'Homepage portfolio statement is missing.'
Assert-True ($Homepage -notmatch 'timeline-home-detail\.webp|class="home-media"|View Work|<a href="about\.html">About</a>') 'Homepage still contains project preview or CTA links.'
Assert-True ([regex]::Matches($Homepage, '<h1\b').Count -eq 1) 'Homepage must have exactly one H1.'
Assert-True ($Homepage -match '<h1[^>]*>Mengjun Duan</h1>' -and $Homepage -notmatch '<h1[^>]*aria-hidden') 'Homepage H1 must expose Mengjun Duan to assistive technology.'
Assert-True ($Homepage -match '<canvas class="home-signal-field" aria-hidden="true"') 'Homepage signal canvas is missing or exposed to assistive technology.'
Assert-True ($Homepage -match '<canvas class="home-signal-field" aria-hidden="true"[^>]*></canvas>\s*<div class="home-text-safe-zone" aria-hidden="true"></div>') 'Homepage text-safe zone must be the Canvas sibling.'
Assert-True ($Homepage -match 'class="home-marquee-copy" aria-hidden="true"') 'Homepage marquee duplicates are not hidden from assistive technology.'
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
Assert-True ($Css -match '\.work-project > img \{[\s\S]*aspect-ratio:\s*16 / 9') 'Work image aspect ratio is missing.'
Assert-True ($Css -match '\.poster-image \{[\s\S]*aspect-ratio:\s*2 / 3') 'Poster image aspect ratio is missing.'
Assert-True ($Css -match '\.home-marquee-track[\s\S]*animation:') 'Homepage marquee animation is missing.'
Assert-True ($Css -match '\.home-signal-field[\s\S]*pointer-events:\s*none') 'Signal canvas must not receive pointer events.'
Assert-True ($Css -match '\.home-page \.home-hero\s*\{[\s\S]*min-height:\s*calc\(100svh - 4\.5rem\)[\s\S]*padding:\s*0') 'Homepage hero must fill the viewport beneath the fixed header.'
Assert-True ($Css -match '\.home-page \.home-signal-field\s*\{[\s\S]*inset:\s*0[;}]') 'Homepage signal canvas must cover the full hero.'
Assert-True ($Css -match '\.home-page \.home-signal-field\s*\{[\s\S]*width:\s*100%[;}]' -and $Css -match '\.home-page \.home-signal-field\s*\{[\s\S]*height:\s*100%[;}]') 'Homepage signal canvas must size to the full hero.'
Assert-True ($Css -match '\.home-page \.home-text-safe-zone[\s\S]*z-index:\s*1' -and $Css -match '\.home-page \.home-text-safe-zone[\s\S]*background') 'Homepage text-safe zone must sit above Canvas with a backing.'
Assert-True ($Css -match '\.home-page \.home-text-safe-zone[\s\S]*background-color:\s*var\(--canvas\)' -and $Css -match '\.home-page \.home-text-safe-zone[\s\S]*background-image:\s*linear-gradient') 'Homepage text-safe backing must preserve its computed canvas color.'
Assert-True ($Css -match '\.home-page \.home-layout[\s\S]*z-index:\s*2') 'Homepage foreground content must sit above the safe zone.'
Assert-True ($Css -match '\.home-page \.home-identity[\s\S]*color:\s*var\(--ink\)') 'Homepage identity must use the ink token.'
Assert-True ($Css -notmatch 'top:\s*24%' -and $Css -notmatch 'width:\s*min\(47vw' -and $Css -notmatch '@media[\s\S]*\.home-signal-field\s*\{\s*display:\s*none') 'Legacy right-side signal-field rules remain.'
Assert-True ($Css -match '\.site-footer\s*\{[^}]*padding-block:\s*0\.75rem') 'Footer padding is not reduced globally.'
Assert-True ($Css -match '\.site-footer \.page-grid > p\s*\{[^}]*grid-column:\s*1 / -1') 'Footer credit is not allowed to use the full grid width.'
Assert-True ($Css -match '@media \(prefers-reduced-motion: reduce\)[\s\S]*\.home-marquee-track') 'Reduced-motion marquee stop is missing.'
$ReducedMotionCss = [regex]::Match($Css, '@media \(prefers-reduced-motion: reduce\)[\s\S]*$').Value
Assert-True ($ReducedMotionCss -match '\.home-page \.home-marquee-track' -and $ReducedMotionCss -notmatch '(?m)^\s*\*,\s*$') 'Reduced-motion marquee and canvas reset must stay scoped to .home-page.'
$Script = Get-Content -Raw -Encoding UTF8 (Join-Path $Root 'scripts/site.js')
$SiteJs = Get-Content -Raw -Encoding UTF8 (Join-Path $Root 'scripts/site.js')
Assert-True ($Script -match 'IntersectionObserver' -and $Script -match 'prefers-reduced-motion') 'Motion fallback is missing.'
Assert-True ($Script -match 'split\(/\\s\+/\)' -and $Script -match 'includes\(current\)') 'Navigation route aliases are unsupported.'
Assert-True ($Script -match 'home-signal-field' -and $Script -match 'requestAnimationFrame') 'Homepage signal-field initializer is missing.'
$AsciiInitializer = [regex]::Match($Script, 'function initializeHomeSignalField[\s\S]*?initializeHomeSignalField\(\);').Value
Assert-True (@(Select-String -Path (Join-Path $Root 'scripts/site.js') -Pattern 'ASCII_GLYPHS' -SimpleMatch).Count -gt 0) 'ASCII glyph constant is missing.'
Assert-True (@(Select-String -Path (Join-Path $Root 'scripts/site.js') -Pattern 'MAX_FPS = 8' -SimpleMatch).Count -gt 0 -and @(Select-String -Path (Join-Path $Root 'scripts/site.js') -Pattern 'CELL_SIZE_DESKTOP = 44' -SimpleMatch).Count -gt 0 -and @(Select-String -Path (Join-Path $Root 'scripts/site.js') -Pattern 'CELL_SIZE_NARROW = 54' -SimpleMatch).Count -gt 0) 'ASCII density or cadence constants are missing.'
Assert-True (@(Select-String -Path (Join-Path $Root 'scripts/site.js') -Pattern 'MAX_ORANGE_RATIO = 0.02' -SimpleMatch).Count -gt 0 -and @(Select-String -Path (Join-Path $Root 'scripts/site.js') -Pattern 'FRAME_INTERVAL' -SimpleMatch).Count -gt 0) 'ASCII orange cap or draw gate is missing.'
Assert-True (@(Select-String -Path (Join-Path $Root 'scripts/site.js') -Pattern 'signalCadence' -SimpleMatch).Count -gt 0 -and @(Select-String -Path (Join-Path $Root 'scripts/site.js') -Pattern 'signalDensity' -SimpleMatch).Count -gt 0 -and @(Select-String -Path (Join-Path $Root 'scripts/site.js') -Pattern 'signalRootStarts' -SimpleMatch).Count -gt 0 -and @(Select-String -Path (Join-Path $Root 'scripts/site.js') -Pattern 'signalCancels' -SimpleMatch).Count -gt 0) 'ASCII runtime datasets are missing.'
Assert-True (@(Select-String -Path (Join-Path $Root 'scripts/site.js') -Pattern 'return (value ^ (value >>> 16)) >>> 0;' -SimpleMatch).Count -gt 0 -and @(Select-String -Path (Join-Path $Root 'scripts/site.js') -Pattern 'ASCII_GLYPHS.length' -SimpleMatch).Count -gt 0) 'ASCII hash/index safety is missing.'
Assert-True (@(Select-String -Path (Join-Path $Root 'scripts/site.js') -Pattern 'SAFE_ZONE_RATIO_NARROW = 1' -SimpleMatch).Count -gt 0 -and @(Select-String -Path (Join-Path $Root 'scripts/site.js') -Pattern 'narrowQuery.matches ? SAFE_ZONE_RATIO_NARROW : SAFE_ZONE_RATIO' -SimpleMatch).Count -gt 0) 'Narrow text-safe zone ratio is missing.'
Assert-True ($AsciiInitializer -notmatch 'arc\(|lineTo\(|stroke\(') 'Legacy point-and-line Canvas drawing remains in the homepage initializer.'
Write-Host 'PASS redesign contract'

