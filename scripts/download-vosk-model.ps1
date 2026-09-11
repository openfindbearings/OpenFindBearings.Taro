# Download Vosk Chinese small model and place it into Android assets (for react-native-vosk@0.3.3)
# Usage: .\scripts\download-vosk-model.ps1
# Note: This script is pure ASCII on purpose - Windows PowerShell 5.1 parses BOM-less
# UTF-8 files as GBK, so any Chinese comments would corrupt the parser. Keep it ASCII.
param(
  [string]$Url = "https://alphacephei.com/vosk/models/vosk-model-small-cn-0.22.zip"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$zip = Join-Path $env:TEMP "vosk-model-small-cn-0.22.zip"
$extractRoot = Join-Path $env:TEMP "vosk-model-extract"
$sourceDir = Join-Path $extractRoot "vosk-model-small-cn-0.22"
$target = Join-Path $root "android\app\src\main\assets\model-cn"

Write-Host "Downloading model: $Url"
Invoke-WebRequest -Uri $Url -OutFile $zip
Write-Host "Downloaded. Extracting..."

if (Test-Path $extractRoot) { Remove-Item -Recurse -Force $extractRoot }
New-Item -ItemType Directory -Force -Path $extractRoot | Out-Null
Expand-Archive -Path $zip -DestinationPath $extractRoot

if (-not (Test-Path $sourceDir)) {
  throw "Extracted dir not found: $sourceDir - check the zip layout"
}

if (Test-Path $target) { Remove-Item -Recurse -Force $target }
New-Item -ItemType Directory -Force -Path $target | Out-Null
Copy-Item -Path "$sourceDir\*" -Destination $target -Recurse

Write-Host "Done. Model placed at: $target"
