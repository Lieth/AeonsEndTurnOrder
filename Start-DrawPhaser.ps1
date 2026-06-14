$ErrorActionPreference = "Stop"

$HostPort = 8123
$Url = "http://127.0.0.1:$HostPort/"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Error "Docker CLI was not found. Start Docker Desktop and try again."
}

Write-Host "Starting DrawPhaser with docker compose ..."
Push-Location $ScriptDir

try {
  docker compose up -d

  if ($LASTEXITCODE -ne 0) {
    Write-Error "docker compose failed to start DrawPhaser."
  }
}
finally {
  Pop-Location
}

Start-Sleep -Milliseconds 700
Start-Process $Url

Write-Host "DrawPhaser is running at $Url"
