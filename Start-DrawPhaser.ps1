$ErrorActionPreference = "Stop"

$ImageName = "drawphaser"
$ContainerName = "DrawPhaser"
$HostPort = 8123
$ContainerPort = 8123
$Url = "http://127.0.0.1:$HostPort/"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Error "Docker CLI was not found. Start Docker Desktop and try again."
}

$oldContainer = docker ps -aq --filter "name=^/$ContainerName$"
if ($oldContainer) {
  docker rm -f $ContainerName | Out-Null
}

$imageExists = docker image ls --format "{{.Repository}}:{{.Tag}}" | Where-Object { $_ -eq "${ImageName}:latest" }
if (-not $imageExists) {
  Write-Host "Building image $ImageName ..."
  docker build -t $ImageName "$ScriptDir"
}

Write-Host "Starting container $ContainerName ..."
docker run -d --name $ContainerName -p "$HostPort`:$ContainerPort" $ImageName | Out-Null

if ($LASTEXITCODE -ne 0) {
  Write-Warning "Could not start container '$ContainerName'. Port $HostPort may already be in use."
  Write-Host "Opening $Url in case another local instance is already running..."
  Start-Process $Url
  exit 0
}

Start-Sleep -Milliseconds 700
Start-Process $Url

Write-Host "DrawPhaser is running at $Url"
