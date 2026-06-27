# update-extension.ps1
# Met à jour le code de l'extension vakargames embarqué dans un .sb3 TurboWarp.
# Usage : .\update-extension.ps1 "C:\chemin\vers\projet.sb3"

param([Parameter(Mandatory)][string]$SB3)

$ExtPath = Join-Path $PSScriptRoot "vakargames.js"

if (-not (Test-Path $SB3))  { Write-Error "Fichier .sb3 introuvable : $SB3"; exit 1 }
if (-not (Test-Path $ExtPath)) { Write-Error "vakargames.js introuvable dans $PSScriptRoot"; exit 1 }

Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression

# Lire et encoder le nouveau code
$code   = [IO.File]::ReadAllText($ExtPath, [Text.Encoding]::UTF8)
$b64    = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($code))
$newUrl = "data:text/javascript;base64,$b64"

# Ouvrir le .sb3 (ZIP) en mode update
$zip = [IO.Compression.ZipFile]::Open($SB3, 'Update')
$entry = $zip.GetEntry('project.json')
if (-not $entry) { $zip.Dispose(); Write-Error "project.json absent du .sb3"; exit 1 }

# Lire project.json
$stream = $entry.Open()
$reader = [IO.StreamReader]::new($stream, [Text.Encoding]::UTF8)
$json   = $reader.ReadToEnd()
$reader.Close(); $stream.Close()

# Remplacer uniquement l'URL de l'extension vakargames (regex, sans parser tout le JSON)
$pattern = '("vakargames"\s*:\s*)"data:[^;]+;base64,[^"]*"'
$newJson = [regex]::Replace($json, $pattern, "`$1`"$newUrl`"")

if ($newJson -eq $json) {
    $zip.Dispose()
    Write-Warning "Extension 'vakargames' non trouvée dans ce .sb3. Charge d'abord l'extension depuis l'onglet Files dans TurboWarp Desktop."
    exit 1
}

# Remplacer project.json dans le ZIP
$entry.Delete()
$newEntry = $zip.CreateEntry('project.json')
$ws = $newEntry.Open()
$w  = [IO.StreamWriter]::new($ws, [Text.Encoding]::UTF8)
$w.Write($newJson)
$w.Close(); $ws.Close()
$zip.Dispose()

Write-Host "Extension mise a jour dans : $SB3"
Write-Host "Recharge le projet dans TurboWarp Desktop."
