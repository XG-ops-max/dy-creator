param(
  [Parameter(Mandatory=$true)][string]$Title,
  [Parameter(Mandatory=$true)][string]$Subtitle,
  [string]$Badge = "",
  [string]$Date = (Get-Date -Format "yyyyMMdd"),
  [string]$Version = "v1",
  [string]$OutputDir = "",
  [string]$FontPath = "",
  [string]$BackgroundTheme = "",
  [string]$BackgroundStyle = "",
  [int]$BackgroundVariant = -1
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

if ([string]::IsNullOrWhiteSpace($Badge)) {
  $Badge = ([string][char]0x5546) + ([string][char]0x4E1A)
}

if ([string]::IsNullOrWhiteSpace($OutputDir)) {
  $OutputDir = Join-Path (Split-Path -Parent $PSScriptRoot) "outputs\covers"
}

if ([string]::IsNullOrWhiteSpace($FontPath)) {
  $skillRoot = Split-Path -Parent $PSScriptRoot
  $projectRoot = (Get-Location).Path
  $fontCandidates = @(
    (Join-Path $projectRoot "dy-creator\fonts\cover-v1-hksong-w12.ttf"),
    (Join-Path $skillRoot "fonts\cover-v1-hksong-w12.ttf"),
    (Join-Path $skillRoot "assets\fonts\cover-v1-hksong-w12.ttf")
  )
  foreach ($candidate in $fontCandidates) {
    if (Test-Path -LiteralPath $candidate) {
      $FontPath = $candidate
      break
    }
  }
}

if ([string]::IsNullOrWhiteSpace($BackgroundTheme)) {
  $BackgroundTheme = $Title
}

if ([string]::IsNullOrWhiteSpace($BackgroundStyle)) {
  $BackgroundStyle = "auto"
}

if (!(Test-Path -LiteralPath $FontPath)) {
  throw "Cover v1 font not found: $FontPath"
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$privateFonts = New-Object System.Drawing.Text.PrivateFontCollection
$privateFonts.AddFontFile($FontPath)
$fontFamily = $privateFonts.Families[0]

function New-UString {
  param([int[]]$Codes)
  return -join ($Codes | ForEach-Object { [string][char]$_ })
}

function Test-ThemeContains {
  param(
    [string]$Text,
    [string[]]$Keywords
  )
  foreach ($keyword in $Keywords) {
    if ($Text.Contains($keyword)) { return $true }
  }
  return $false
}

function Get-StableVariant {
  param(
    [string]$Text,
    [int]$Count
  )
  if ($Count -le 1) { return 0 }
  $sum = 0
  foreach ($char in $Text.ToCharArray()) {
    $sum += [int][char]$char
  }
  return ($sum % $Count)
}

function Resolve-BackgroundStyle {
  param(
    [string]$Style,
    [string]$Theme,
    [string]$Title,
    [string]$Subtitle
  )
  if (![string]::IsNullOrWhiteSpace($Style) -and $Style -ne "auto") { return $Style }

  $text = "$Theme $Title $Subtitle"
  $market = @(
    (New-UString @(0x5341,0x5143)),
    (New-UString @(0x751F,0x610F)),
    (New-UString @(0x7B2C,0x4E00,0x5355)),
    (New-UString @(0x6210,0x4EA4)),
    (New-UString @(0x5E02,0x573A))
  )
  $freelance = @(
    (New-UString @(0x81EA,0x7531,0x804C,0x4E1A)),
    (New-UString @(0x4E0D,0x4E0A,0x73ED)),
    (New-UString @(0x526F,0x4E1A)),
    (New-UString @(0x5BA2,0x6237)),
    (New-UString @(0x516C,0x53F8))
  )
  $housing = @(
    (New-UString @(0x4E70,0x623F)),
    (New-UString @(0x623F,0x5974)),
    (New-UString @(0x623F,0x8D37)),
    (New-UString @(0x623F,0x672C))
  )
  $trap = @(
    (New-UString @(0x719F,0x4EBA)),
    (New-UString @(0x8BBE,0x5C40)),
    (New-UString @(0x996D,0x5C40)),
    (New-UString @(0x5408,0x4F5C))
  )
  $game = @(
    (New-UString @(0x6E38,0x620F)),
    (New-UString @(0x81EA,0x63A7)),
    (New-UString @(0x7236,0x6BCD)),
    (New-UString @(0x7B5B,0x9009))
  )
  $workSystem = @(
    (New-UString @(0x81EA,0x5F8B)),
    (New-UString @(0x6253,0x5DE5)),
    (New-UString @(0x5DE5,0x5382)),
    (New-UString @(0x4E0A,0x73ED))
  )

  if (Test-ThemeContains $text $market) { return "market" }
  if (Test-ThemeContains $text $freelance) { return "freelance" }
  if (Test-ThemeContains $text $housing) { return "housing" }
  if (Test-ThemeContains $text $trap) { return "trap" }
  if (Test-ThemeContains $text $game) { return "game" }
  if (Test-ThemeContains $text $workSystem) { return "work-system" }

  Write-Warning "No dedicated cover background category matched. Using default background."
  return "default"
}

$ResolvedBackgroundStyle = Resolve-BackgroundStyle -Style $BackgroundStyle -Theme $BackgroundTheme -Title $Title -Subtitle $Subtitle
if ($BackgroundVariant -lt 0) {
  $BackgroundVariant = Get-StableVariant -Text "$BackgroundTheme|$Title|$Subtitle|$ResolvedBackgroundStyle" -Count 3
}

function Draw-DefaultPosterBackground {
  param(
    [System.Drawing.Graphics]$g,
    [int]$Width,
    [int]$Height
  )

  $rect = New-Object System.Drawing.Rectangle 0, 0, $Width, $Height
  $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, ([System.Drawing.Color]::FromArgb(15,18,20)), ([System.Drawing.Color]::FromArgb(48,38,30)), 55
  $g.FillRectangle($bg, $rect)
  $bg.Dispose()

  for ($i = 0; $i -lt 12; $i++) {
    $x = [int]($i * $Width / 11 - $Width * 0.05)
    $bw = [int]($Width * (0.08 + ($i % 4) * 0.018))
    $bh = [int]($Height * (0.18 + (($i * 37) % 100) / 500.0))
    $y = [int]($Height * 0.36 - $bh * 0.2 + (($i % 3) - 1) * $Height * 0.03)
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(90, 60 + ($i % 3) * 12, 55 + ($i % 4) * 10, 48))
    $g.FillRectangle($brush, $x, $y, $bw, $bh)
    $brush.Dispose()

    $linePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(45,230,190,120)), 2
    for ($yy = $y + 20; $yy -lt $y + $bh - 10; $yy += 34) {
      $g.DrawLine($linePen, $x + 8, $yy, $x + $bw - 10, $yy)
    }
    $linePen.Dispose()
  }

  $tableY = [int]($Height * 0.55)
  $tableBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(130,28,24,21))
  $g.FillRectangle($tableBrush, 0, $tableY, $Width, [int]($Height * 0.22))
  $tableBrush.Dispose()

  for ($i = 0; $i -lt 7; $i++) {
    $cx = [int]($Width * (0.12 + $i * 0.13))
    $cy = [int]($Height * (0.50 + (($i % 2) * 0.035)))
    $personBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(105,16,16,15))
    $g.FillEllipse($personBrush, $cx - 22, $cy - 65, 44, 44)
    $g.FillRectangle($personBrush, $cx - 34, $cy - 24, 68, 92)
    $personBrush.Dispose()
  }

  $lightRect = New-Object System.Drawing.RectangleF ([float]($Width * 0.25)), ([float]($Height * 0.03)), ([float]($Width * 0.50)), ([float]($Height * 0.70))
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddEllipse($lightRect)
  $glow = New-Object System.Drawing.Drawing2D.PathGradientBrush $path
  $glow.CenterColor = [System.Drawing.Color]::FromArgb(75,255,215,150)
  $glow.SurroundColors = @([System.Drawing.Color]::FromArgb(0,255,215,150))
  $g.FillPath($glow, $path)
  $glow.Dispose()
  $path.Dispose()
}

function Draw-TenYuanBusinessBackground {
  param(
    [System.Drawing.Graphics]$g,
    [int]$Width,
    [int]$Height
  )

  $rect = New-Object System.Drawing.Rectangle 0, 0, $Width, $Height
  $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, ([System.Drawing.Color]::FromArgb(14,22,24)), ([System.Drawing.Color]::FromArgb(74,48,25)), 70
  $g.FillRectangle($bg, $rect)
  $bg.Dispose()

  $floorBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(170,22,21,19))
  $g.FillRectangle($floorBrush, 0, [int]($Height * 0.58), $Width, [int]($Height * 0.42))
  $floorBrush.Dispose()

  for ($i = 0; $i -lt 9; $i++) {
    $cx = [int]($Width * (0.08 + $i * 0.105))
    $cy = [int]($Height * (0.20 + (($i % 3) * 0.045)))
    $r = [int]($Height * (0.018 + ($i % 2) * 0.006))
    $lamp = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(180,255,188,74))
    $g.FillEllipse($lamp, $cx - $r, $cy - $r, $r * 2, $r * 2)
    $lamp.Dispose()
    $glow = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(34,255,188,74))
    $g.FillEllipse($glow, $cx - $r * 5, $cy - $r * 5, $r * 10, $r * 10)
    $glow.Dispose()
  }

  $stallX = [int]($Width * 0.16)
  $stallY = [int]($Height * 0.28)
  $stallW = [int]($Width * 0.68)
  $stallH = [int]($Height * 0.34)

  $awningDark = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(95,84,23,20))
  $awningLight = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(85,158,119,52))
  for ($i = 0; $i -lt 8; $i++) {
    $segX = $stallX + [int]($i * $stallW / 8)
    $segW = [int]($stallW / 8) + 2
    $brush = $(if ($i % 2 -eq 0) { $awningDark } else { $awningLight })
    $g.FillRectangle($brush, $segX, $stallY, $segW, [int]($Height * 0.085))
  }
  $awningDark.Dispose()
  $awningLight.Dispose()

  $veilBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(95,18,17,15))
  $g.FillRectangle($veilBrush, $stallX, $stallY - 4, $stallW, [int]($Height * 0.095))
  $veilBrush.Dispose()

  $counterBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(185,42,29,22))
  $g.FillRectangle($counterBrush, $stallX, [int]($stallY + $stallH * 0.46), $stallW, [int]($stallH * 0.28))
  $counterBrush.Dispose()

  $seller = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(160,18,18,18))
  $sx = [int]($Width * 0.34)
  $sy = [int]($Height * 0.47)
  $g.FillEllipse($seller, $sx - 30, $sy - 105, 60, 60)
  $g.FillRectangle($seller, $sx - 46, $sy - 50, 92, 130)
  $seller.Dispose()

  $buyer = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(150,15,16,17))
  $bx = [int]($Width * 0.66)
  $by = [int]($Height * 0.52)
  $g.FillEllipse($buyer, $bx - 28, $by - 120, 56, 56)
  $g.FillRectangle($buyer, $bx - 42, $by - 70, 84, 145)
  $buyer.Dispose()

  $handPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(185,230,185,150)), ([single]($Height * 0.022))
  $g.DrawLine($handPen, [int]($Width * 0.40), [int]($Height * 0.50), [int]($Width * 0.50), [int]($Height * 0.53))
  $g.DrawLine($handPen, [int]($Width * 0.62), [int]($Height * 0.52), [int]($Width * 0.52), [int]($Height * 0.53))
  $handPen.Dispose()

  $coin = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(230,244,199,80))
  $g.FillEllipse($coin, [int]($Width * 0.492), [int]($Height * 0.505), [int]($Height * 0.04), [int]($Height * 0.04))
  $coin.Dispose()

  for ($i = 0; $i -lt 6; $i++) {
    $itemBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(150, 170 + ($i % 2) * 50, 70 + ($i % 3) * 24, 38))
    $g.FillEllipse($itemBrush, $stallX + [int]($stallW * (0.12 + $i * 0.12)), [int]($stallY + $stallH * 0.56), [int]($Height * 0.05), [int]($Height * 0.04))
    $itemBrush.Dispose()
  }

  $lightRect = New-Object System.Drawing.RectangleF ([float]($Width * 0.18)), ([float]($Height * 0.08)), ([float]($Width * 0.64)), ([float]($Height * 0.68))
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddEllipse($lightRect)
  $glow = New-Object System.Drawing.Drawing2D.PathGradientBrush $path
  $glow.CenterColor = [System.Drawing.Color]::FromArgb(70,255,196,96)
  $glow.SurroundColors = @([System.Drawing.Color]::FromArgb(0,255,196,96))
  $g.FillPath($glow, $path)
  $glow.Dispose()
  $path.Dispose()
}

function Draw-FreelanceBackground {
  param(
    [System.Drawing.Graphics]$g,
    [int]$Width,
    [int]$Height
  )

  $rect = New-Object System.Drawing.Rectangle 0, 0, $Width, $Height
  $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, ([System.Drawing.Color]::FromArgb(13,18,21)), ([System.Drawing.Color]::FromArgb(36,31,27)), 65
  $g.FillRectangle($bg, $rect)
  $bg.Dispose()

  $deskBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(150,28,24,21))
  $g.FillRectangle($deskBrush, 0, [int]($Height * 0.58), $Width, [int]($Height * 0.42))
  $deskBrush.Dispose()

  $screenX = [int]($Width * 0.26)
  $screenY = [int]($Height * 0.22)
  $screenW = [int]($Width * 0.48)
  $screenH = [int]($Height * 0.28)
  $screenBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(120,35,45,45))
  $g.FillRectangle($screenBrush, $screenX, $screenY, $screenW, $screenH)
  $screenBrush.Dispose()

  $screenLine = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(55,214,178,94)), 3
  for ($i = 0; $i -lt 6; $i++) {
    $y = $screenY + [int]($screenH * (0.18 + $i * 0.12))
    $g.DrawLine($screenLine, $screenX + [int]($screenW * 0.10), $y, $screenX + [int]($screenW * (0.50 + ($i % 3) * 0.10)), $y)
  }
  $screenLine.Dispose()

  $personBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(120,14,15,15))
  $cx = [int]($Width * 0.50)
  $cy = [int]($Height * 0.57)
  $g.FillEllipse($personBrush, $cx - 30, $cy - 115, 60, 60)
  $g.FillRectangle($personBrush, $cx - 48, $cy - 60, 96, 135)
  $personBrush.Dispose()

  $nodeBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(150,220,164,70))
  $nodePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(70,220,164,70)), 3
  $points = @(
    @(0.18,0.34), @(0.28,0.20), @(0.73,0.22), @(0.83,0.38),
    @(0.22,0.52), @(0.78,0.54)
  )
  foreach ($p in $points) {
    $x = [int]($Width * $p[0])
    $y = [int]($Height * $p[1])
    $g.DrawLine($nodePen, $cx, [int]($Height * 0.45), $x, $y)
    $g.FillEllipse($nodeBrush, $x - 16, $y - 16, 32, 32)
  }
  $nodePen.Dispose()
  $nodeBrush.Dispose()

  $cardBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(75,66,58,45))
  for ($i = 0; $i -lt 4; $i++) {
    $x = [int]($Width * (0.16 + $i * 0.18))
    $y = [int]($Height * 0.61 + (($i % 2) * $Height * 0.035))
    $g.FillRectangle($cardBrush, $x, $y, [int]($Width * 0.12), [int]($Height * 0.065))
  }
  $cardBrush.Dispose()

  $lightRect = New-Object System.Drawing.RectangleF ([float]($Width * 0.20)), ([float]($Height * 0.04)), ([float]($Width * 0.60)), ([float]($Height * 0.68))
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddEllipse($lightRect)
  $glow = New-Object System.Drawing.Drawing2D.PathGradientBrush $path
  $glow.CenterColor = [System.Drawing.Color]::FromArgb(62,224,174,92)
  $glow.SurroundColors = @([System.Drawing.Color]::FromArgb(0,224,174,92))
  $g.FillPath($glow, $path)
  $glow.Dispose()
  $path.Dispose()
}

function Draw-SymbolicThemeBackground {
  param(
    [System.Drawing.Graphics]$g,
    [int]$Width,
    [int]$Height,
    [string]$Style
  )

  $rect = New-Object System.Drawing.Rectangle 0, 0, $Width, $Height
  $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, ([System.Drawing.Color]::FromArgb(13,17,20)), ([System.Drawing.Color]::FromArgb(38,31,28)), 60
  $g.FillRectangle($bg, $rect)
  $bg.Dispose()

  $ground = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(145,26,23,21))
  $g.FillRectangle($ground, 0, [int]($Height * 0.58), $Width, [int]($Height * 0.42))
  $ground.Dispose()

  $gold = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(120,218,162,66))
  $dimGold = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(70,218,162,66))
  $dark = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(125,16,16,15))
  $line = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(65,218,162,66)), 5
  $thinLine = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(55,218,162,66)), 3

  $variant = $script:BackgroundVariant
  if ($Style -eq "housing") {
    $houseX = [int]($Width * (0.30 + 0.04 * $variant))
    $houseY = [int]($Height * 0.25)
    $houseW = [int]($Width * 0.40)
    $houseH = [int]($Height * 0.28)
    $roof = [System.Drawing.Point[]] @(
      (New-Object System.Drawing.Point ($houseX - [int]($houseW * 0.08)), ($houseY + [int]($houseH * 0.34))),
      (New-Object System.Drawing.Point ($houseX + [int]($houseW * 0.50)), ($houseY - [int]($houseH * 0.10))),
      (New-Object System.Drawing.Point ($houseX + $houseW + [int]($houseW * 0.08)), ($houseY + [int]($houseH * 0.34)))
    )
    $g.FillPolygon($dimGold, $roof)
    $g.FillRectangle($dark, $houseX, $houseY + [int]($houseH * 0.30), $houseW, $houseH)
    for ($i = 0; $i -lt 5; $i++) {
      $g.DrawLine($thinLine, $houseX + [int]($houseW * 0.14), $houseY + [int]($houseH * (0.44 + $i * 0.10)), $houseX + [int]($houseW * 0.86), $houseY + [int]($houseH * (0.44 + $i * 0.10)))
    }
  } elseif ($Style -eq "trap") {
    $tableY = [int]($Height * 0.48)
    $g.FillRectangle($dark, [int]($Width * 0.18), $tableY, [int]($Width * 0.64), [int]($Height * 0.13))
    for ($i = 0; $i -lt 6; $i++) {
      $x = [int]($Width * (0.20 + $i * 0.12))
      $y = [int]($Height * (0.35 + (($i + $variant) % 2) * 0.12))
      $g.FillEllipse($dimGold, $x - 22, $y - 22, 44, 44)
      $g.DrawLine($thinLine, $x, $y + 25, [int]($Width * 0.50), $tableY + 35)
    }
  } elseif ($Style -eq "game") {
    $padX = [int]($Width * 0.31)
    $padY = [int]($Height * 0.32)
    $padW = [int]($Width * 0.38)
    $padH = [int]($Height * 0.18)
    $g.FillEllipse($dark, $padX - [int]($padW * 0.18), $padY, [int]($padW * 0.42), $padH)
    $g.FillEllipse($dark, $padX + [int]($padW * 0.76), $padY, [int]($padW * 0.42), $padH)
    $g.FillRectangle($dark, $padX, $padY + [int]($padH * 0.22), $padW, [int]($padH * 0.56))
    $g.DrawLine($line, $padX + [int]($padW * 0.18), $padY + [int]($padH * 0.50), $padX + [int]($padW * 0.34), $padY + [int]($padH * 0.50))
    $g.DrawLine($line, $padX + [int]($padW * 0.26), $padY + [int]($padH * 0.36), $padX + [int]($padW * 0.26), $padY + [int]($padH * 0.64))
    $g.FillEllipse($gold, $padX + [int]($padW * 0.68), $padY + [int]($padH * 0.36), 30, 30)
    $g.FillEllipse($gold, $padX + [int]($padW * 0.78), $padY + [int]($padH * 0.52), 30, 30)
  } elseif ($Style -eq "work-system") {
    $clockX = [int]($Width * 0.50)
    $clockY = [int]($Height * 0.35)
    $r = [int]($Height * 0.13)
    $g.DrawEllipse($line, $clockX - $r, $clockY - $r, $r * 2, $r * 2)
    $g.DrawLine($line, $clockX, $clockY, $clockX, $clockY - [int]($r * 0.62))
    $g.DrawLine($line, $clockX, $clockY, $clockX + [int]($r * 0.55), $clockY + [int]($r * 0.25))
    for ($i = 0; $i -lt 5; $i++) {
      $x = [int]($Width * (0.22 + $i * 0.14))
      $g.FillRectangle($dark, $x, [int]($Height * 0.58), [int]($Width * 0.09), [int]($Height * (0.06 + 0.015 * (($i + $variant) % 3))))
    }
  } else {
    for ($i = 0; $i -lt 7; $i++) {
      $x = [int]($Width * (0.16 + $i * 0.11))
      $y = [int]($Height * (0.35 + (($i + $variant) % 3) * 0.05))
      $g.FillRectangle($dark, $x, $y, [int]($Width * 0.08), [int]($Height * 0.22))
      $g.DrawLine($thinLine, $x + 10, $y + 30, $x + [int]($Width * 0.07), $y + 30)
      $g.DrawLine($thinLine, $x + 10, $y + 60, $x + [int]($Width * 0.065), $y + 60)
    }
  }

  $lightRect = New-Object System.Drawing.RectangleF ([float]($Width * 0.18)), ([float]($Height * 0.06)), ([float]($Width * 0.64)), ([float]($Height * 0.68))
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddEllipse($lightRect)
  $glow = New-Object System.Drawing.Drawing2D.PathGradientBrush $path
  $glow.CenterColor = [System.Drawing.Color]::FromArgb(58,224,174,92)
  $glow.SurroundColors = @([System.Drawing.Color]::FromArgb(0,224,174,92))
  $g.FillPath($glow, $path)
  $glow.Dispose()
  $path.Dispose()

  $gold.Dispose()
  $dimGold.Dispose()
  $dark.Dispose()
  $line.Dispose()
  $thinLine.Dispose()
}

function Draw-CoverV1 {
  param(
    [int]$Width,
    [int]$Height,
    [string]$Ratio,
    [string]$OutPath
  )

  $bmp = New-Object System.Drawing.Bitmap $Width, $Height
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  if ($ResolvedBackgroundStyle -eq "market") {
    Draw-TenYuanBusinessBackground -g $g -Width $Width -Height $Height
  } elseif ($ResolvedBackgroundStyle -eq "freelance") {
    Draw-FreelanceBackground -g $g -Width $Width -Height $Height
  } elseif (@("housing", "trap", "game", "work-system") -contains $ResolvedBackgroundStyle) {
    Draw-SymbolicThemeBackground -g $g -Width $Width -Height $Height -Style $ResolvedBackgroundStyle
  } else {
    Draw-DefaultPosterBackground -g $g -Width $Width -Height $Height
  }

  $fontMain = New-Object System.Drawing.Font $fontFamily, ([single]($Height * 0.155)), ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  $fontSub = New-Object System.Drawing.Font $fontFamily, ([single]($Height * 0.058)), ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  $fontBadge = New-Object System.Drawing.Font $fontFamily, ([single]($Height * 0.045)), ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)

  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = [System.Drawing.StringAlignment]::Center
  $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
  $sf.FormatFlags = [System.Drawing.StringFormatFlags]::NoWrap
  $badgeSf = New-Object System.Drawing.StringFormat
  $badgeSf.Alignment = [System.Drawing.StringAlignment]::Center
  $badgeSf.LineAlignment = [System.Drawing.StringAlignment]::Center

  $mainRect = New-Object System.Drawing.RectangleF 0, ([single]($Height * 0.68 - $Height * 0.12)), ([single]$Width), ([single]($Height * 0.20))
  $subRect = New-Object System.Drawing.RectangleF ([single]($Width * 0.05)), ([single]($Height * 0.83 - $Height * 0.05)), ([single]($Width * 0.90)), ([single]($Height * 0.10))

  if ($Ratio -eq "3x4") {
    # Keep the fixed V1 layout while shrinking long subtitles to a single safe line.
    while ($g.MeasureString($Subtitle, $fontSub).Width -gt ($subRect.Width - 24) -and $fontSub.Size -gt ($Height * 0.034)) {
      $nextSize = [single]($fontSub.Size - 2)
      $fontSub.Dispose()
      $fontSub = New-Object System.Drawing.Font $fontFamily, $nextSize, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
    }
  }

  $shadow = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(230,0,0,0))
  $red = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(232,0,0))
  $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(245,245,238))

  $g.DrawString($Title, $fontMain, $shadow, (New-Object System.Drawing.RectangleF 8, ([single]($mainRect.Y + 8)), ([single]$Width), $mainRect.Height), $sf)
  $g.DrawString($Title, $fontMain, $red, $mainRect, $sf)
  $g.DrawString($Subtitle, $fontSub, $shadow, (New-Object System.Drawing.RectangleF ([single]($subRect.X + 5)), ([single]($subRect.Y + 5)), $subRect.Width, $subRect.Height), $sf)
  $g.DrawString($Subtitle, $fontSub, $white, $subRect, $sf)

  $badgeBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(190,18,18))
  $points = [System.Drawing.Point[]] @(
    (New-Object System.Drawing.Point ([int]($Width * 0.035)), 0),
    (New-Object System.Drawing.Point ([int]($Width * 0.185)), 0),
    (New-Object System.Drawing.Point ([int]($Width * 0.165)), ([int]($Height * 0.13))),
    (New-Object System.Drawing.Point ([int]($Width * 0.108)), ([int]($Height * 0.16))),
    (New-Object System.Drawing.Point ([int]($Width * 0.055)), ([int]($Height * 0.13)))
  )
  $g.FillPolygon($badgeBrush, $points)
  $badgeBrush.Dispose()

  $badgeRect = New-Object System.Drawing.RectangleF ([single]($Width * 0.04)), ([single]($Height * 0.016)), ([single]($Width * 0.14)), ([single]($Height * 0.11))
  $g.DrawString($Badge, $fontBadge, $white, $badgeRect, $badgeSf)

  $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(95,0,0,0)), ([single]($Width * 0.055))
  $g.DrawRectangle($pen, 0, 0, $Width, $Height)
  $pen.Dispose()

  $fontMain.Dispose()
  $fontSub.Dispose()
  $fontBadge.Dispose()
  $sf.Dispose()
  $badgeSf.Dispose()
  $shadow.Dispose()
  $red.Dispose()
  $white.Dispose()

  $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
}

$safeTitle = $Title -replace '[\\/:*?"<>|]', ''
$out4x3 = Join-Path $OutputDir "$safeTitle`_4x3_$Version`_$Date.png"
$out3x4 = Join-Path $OutputDir "$safeTitle`_3x4_$Version`_$Date.png"

Draw-CoverV1 -Width 1600 -Height 1200 -Ratio "4x3" -OutPath $out4x3
Draw-CoverV1 -Width 1200 -Height 1600 -Ratio "3x4" -OutPath $out3x4

Get-Item -LiteralPath $out4x3, $out3x4 | Select-Object FullName, Length
