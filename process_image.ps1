Add-Type -AssemblyName System.Drawing

function Clean-Image {
    param([string]$inPath, [string]$outPath)
    
    $bmp = New-Object System.Drawing.Bitmap($inPath)
    $w = $bmp.Width
    $h = $bmp.Height
    
    # Analyze corners to identify background colors
    $bgColors = @{}
    foreach ($pt in @(@(0,0), @($w-1,0), @(0,$h-1), @($w-1,$h-1), @(1,0), @(0,1))) {
        $c = $bmp.GetPixel($pt[0], $pt[1])
        # Only consider gray/white as checkerboard candidates
        if ([Math]::Abs($c.R - $c.G) -lt 15 -and [Math]::Abs($c.G - $c.B) -lt 15 -and $c.R -gt 150) {
            $bgColors[$c.ToArgb()] = $c
        }
    }
    
    # If no bright grays/whites found in corners, maybe it's just white/transparent already.
    # We will make anything matching those bgColors transparent.
    # To handle aliasing, we can also check similar colors.
    
    for ($y = 0; $y -lt $h; $y++) {
        for ($x = 0; $x -lt $w; $x++) {
            $c = $bmp.GetPixel($x, $y)
            $isBg = $false
            foreach ($bg in $bgColors.Values) {
                if ([Math]::Abs($c.R - $bg.R) -lt 30 -and [Math]::Abs($c.G - $bg.G) -lt 30 -and [Math]::Abs($c.B - $bg.B) -lt 30) {
                    $isBg = $true
                    break
                }
            }
            # Also remove absolute white or near white/gray checkerboard
            if ([Math]::Abs($c.R - $c.G) -lt 15 -and [Math]::Abs($c.G - $c.B) -lt 15 -and $c.R -gt 200) {
                $isBg = $true
            }
            if ($isBg) {
                $bmp.SetPixel($x, $y, [System.Drawing.Color]::Transparent)
            }
        }
    }
    
    # Autocrop
    $minX = $w; $maxX = 0; $minY = $h; $maxY = 0
    for ($y = 0; $y -lt $h; $y++) {
        for ($x = 0; $x -lt $w; $x++) {
            if ($bmp.GetPixel($x, $y).A -gt 0) {
                if ($x -lt $minX) { $minX = $x }
                if ($x -gt $maxX) { $maxX = $x }
                if ($y -lt $minY) { $minY = $y }
                if ($y -gt $maxY) { $maxY = $y }
            }
        }
    }
    
    if ($minX -le $maxX -and $minY -le $maxY) {
        $cropRect = New-Object System.Drawing.Rectangle($minX, $minY, ($maxX - $minX + 1), ($maxY - $minY + 1))
        $cropped = $bmp.Clone($cropRect, $bmp.PixelFormat)
        $cropped.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $cropped.Dispose()
    } else {
        $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    
    $bmp.Dispose()
    Write-Host "Processed $inPath -> $outPath"
}

Clean-Image -inPath "C:\Users\kexuc\Downloads\AlphaLab.png" -outPath "C:\Users\kexuc\project\Alpha_lab\frontend\public\brand\alphalab-logo.png"
Clean-Image -inPath "C:\Users\kexuc\Downloads\AlphaLab_symbol.png" -outPath "C:\Users\kexuc\project\Alpha_lab\frontend\public\brand\alphalab-icon.png"
