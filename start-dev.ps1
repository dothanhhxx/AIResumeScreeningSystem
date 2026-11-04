$ErrorActionPreference = "Stop"
$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$BackendDir = Join-Path $RootDir "backend"
$FrontendDir = Join-Path $RootDir "frontend"
$BackendEnv = Join-Path $BackendDir ".env"
$FrontendEnv = Join-Path $FrontendDir ".env.local"

if (-not (Test-Path $BackendEnv)) {
    $envContent = @"
DATABASE_URL=sqlite+aiosqlite:///./dev.db
AUTO_CREATE_TABLES=true
STORAGE_BACKEND=local
PIPELINE_MODE=inline
GEMINI_API_KEY=
"@
    [System.IO.File]::WriteAllText($BackendEnv, $envContent)
    Write-Host "[Backend] Created default backend/.env" -ForegroundColor Green
}

if (-not (Test-Path $FrontendEnv)) {
    [System.IO.File]::WriteAllText($FrontendEnv, "NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`n")
    Write-Host "[Frontend] Created default frontend/.env.local" -ForegroundColor Green
}

Write-Host "Starting Backend (http://localhost:8000) in a new window..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$BackendDir'; .\.venv\Scripts\Activate.ps1; uvicorn app.main:app --reload --port 8000"

Write-Host "Starting Frontend (http://localhost:3000) in a new window..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$FrontendDir'; pnpm dev"

Write-Host "Done! Both Backend and Frontend are starting." -ForegroundColor Green

