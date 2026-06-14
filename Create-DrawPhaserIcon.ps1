$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$pngPath = Join-Path (Get-Location) "resources\Nemesis.png"
$icoPath = Join-Path (Get-Location) "DrawPhaser.ico"

$img = [System.Drawing.Image]::FromFile($pngPath)

try {
  $w = [Math]::Min($img.Width, 256)
  $h = [Math]::Min($img.Height, 256)

  $pngBytes = [System.IO.File]::ReadAllBytes($pngPath)

  $ms = New-Object System.IO.MemoryStream
  $bw = New-Object System.IO.BinaryWriter($ms)

  # ICO header
  $bw.Write([UInt16]0) # reserved
  $bw.Write([UInt16]1) # image type: icon
  $bw.Write([UInt16]1) # number of images

  # ICONDIRENTRY
  $bw.Write([Byte]($(if ($w -ge 256) { 0 } else { $w })))
  $bw.Write([Byte]($(if ($h -ge 256) { 0 } else { $h })))
  $bw.Write([Byte]0)   # color count
  $bw.Write([Byte]0)   # reserved
  $bw.Write([UInt16]1) # planes
  $bw.Write([UInt16]32) # bpp
  $bw.Write([UInt32]$pngBytes.Length)
  $bw.Write([UInt32](6 + 16))

  # PNG payload
  $bw.Write($pngBytes)

  [System.IO.File]::WriteAllBytes($icoPath, $ms.ToArray())

  $bw.Close()
  $ms.Close()

  Write-Host "Created icon: $icoPath"
}
finally {
  $img.Dispose()
}
