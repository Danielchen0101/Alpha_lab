Add-Type -AssemblyName System.Drawing

function Fix-AlphaLabLogo {
    param(
        [string]$inPath,
        [string]$outPath
    )
    
    if (-not (Test-Path $inPath)) {
        Write-Error "Source file not found: $inPath"
        return
    }

    $bmp = New-Object System.Drawing.Bitmap($inPath)
    $w = $bmp.Width
    $h = $bmp.Height
    
    # Create a copy with ARGB format to ensure transparency support
    $newBmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppPArgb)
    $g = [System.Drawing.Graphics]::FromImage($newBmp)
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($bmp, 0, 0, $w, $h)
    $g.Dispose()
    $bmp.Dispose()

    # Pixel processing
    for ($y = 0; $y -lt $h; $y++) {
        for ($x = 0; $x -lt $w; $x++) {
            $c = $newBmp.GetPixel($x, $y)
            
            $r = $c.R
            $g_val = $c.G
            $b = $c.B
            
            $max_rgb = [Math]::Max($r, [Math]::Max($g_val, $b))
            $diff_rg = [Math]::Abs($r - $g_val)
            $diff_gb = [Math]::Abs($g_val - $b)
            
            # Logic: If low saturation and dark, it's background
            if ($max_rgb -lt 95 -and $diff_rg -lt 20 -and $diff_gb -lt 20) {
                $newBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, $r, $g_val, $b))
            }
            # Optional: handle transition/semi-transparent edges if needed
            # For now, stick to the clear removal as requested.
        }
    }
    
    # Autocrop
    $minX = $w; $maxX = 0; $minY = $h; $maxY = 0
    for ($y = 0; $y -lt $h; $y++) {
        for ($x = 0; $x -lt $w; $x++) {
            if ($newBmp.GetPixel($x, $y).A -gt 0) {
                if ($x -lt $minX) { $minX = $x }
                if ($x -gt $maxX) { $maxX = $x }
                if ($y -lt $minY) { $minY = $y }
                if ($y -gt $maxY) { $maxY = $y }
            }
        }
    }
    
    if ($minX -le $maxX -and $minY -le $maxY) {
        $padding = 4
        $cropX = [Math]::Max(0, $minX - $padding)
        $cropY = [Math]::Max(0, $minY - $padding)
        $cropW = [Math]::Min($w - $cropX, ($maxX - $minX + 1) + 2 * $padding)
        $cropH = [Math]::Min($h - $cropY, ($maxY - $minY + 1) + 2 * $padding)
        
        $cropRect = New-Object System.Drawing.Rectangle($cropX, $cropY, $cropW, $cropH)
        $finalBmp = $newBmp.Clone($cropRect, $newBmp.PixelFormat)
        $finalBmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
        
        # Verify transparency
        $vW = $finalBmp.Width
        $vH = $finalBmp.Height
        $c1 = $finalBmp.GetPixel(0, 0).A
        $c2 = $finalBmp.GetPixel($vW - 1, 0).A
        $c3 = $finalBmp.GetPixel(0, $vH - 1).A
        $c4 = $finalBmp.GetPixel($vW - 1, $vH - 1).A
        
        $totalPixels = $vW * $vH
        $edgeTransparent = 0
        for ($x = 0; $x -lt $vW; $x++) {
            if ($finalBmp.GetPixel($x, 0).A -eq 0) { $edgeTransparent++ }
            if ($finalBmp.GetPixel($x, $vH - 1).A -eq 0) { $edgeTransparent++ }
        }
        for ($y = 1; $y -lt $vH - 1; $y++) {
            if ($finalBmp.GetPixel(0, $y).A -eq 0) { $edgeTransparent++ }
            if ($finalBmp.GetPixel($vW - 1, $y).A -eq 0) { $edgeTransparent++ }
        }
        $edgeCount = 2 * $vW + 2 * ($vH - 2)
        $ratio = ($edgeTransparent / $edgeCount) * 100
        
        Write-Host "Transparency Verification:"
        Write-Host "logo corners alpha: $c1,$c2,$c3,$c4"
        Write-Host "edge transparent ratio: $($ratio.ToString('F2'))%"
        
        $finalBmp.Dispose()
    } else {
        Write-Error "No non-transparent pixels found after processing."
    }
    
    $newBmp.Dispose()
}

Fix-AlphaLabLogo -inPath "C:\Users\kexuc\Downloads\AlphaLab_logo_blk.png" -outPath "frontend\public\brand\alphalab-logo.png"
