<#
.SYNOPSIS
    Supabase 마이그레이션 동기화 스크립트

.DESCRIPTION
    개발 환경에서 프로덕션 환경으로 Supabase 마이그레이션을 동기화합니다.
    Supabase CLI가 설치되어 있어야 합니다.

.PARAMETER Target
    마이그레이션을 적용할 대상 환경 (development 또는 production)

.PARAMETER DryRun
    실제 적용하지 않고 변경 사항만 확인

.EXAMPLE
    .\sync-migrations.ps1 -Target development
    .\sync-migrations.ps1 -Target production -DryRun
#>

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("development", "production")]
    [string]$Target,
    
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

# 색상 출력 함수
function Write-Info { param($Message) Write-Host "[INFO] $Message" -ForegroundColor Cyan }
function Write-Success { param($Message) Write-Host "[SUCCESS] $Message" -ForegroundColor Green }
function Write-Warn { param($Message) Write-Host "[WARNING] $Message" -ForegroundColor Yellow }
function Write-Err { param($Message) Write-Host "[ERROR] $Message" -ForegroundColor Red }

# 환경별 설정
$config = @{
    development = @{
        EnvVarName = "SUPABASE_DEV_DB_URL"
        Description = "Development Supabase"
    }
    production = @{
        EnvVarName = "SUPABASE_PROD_DB_URL"
        Description = "Production Supabase"
    }
}

$targetConfig = $config[$Target]

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor White
Write-Host " Supabase Migration Sync" -ForegroundColor White
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor White
Write-Host ""

# 환경 변수 확인
$dbUrl = [Environment]::GetEnvironmentVariable($targetConfig.EnvVarName)

if (-not $dbUrl) {
    Write-Err "환경 변수 $($targetConfig.EnvVarName)이(가) 설정되지 않았습니다."
    Write-Host ""
    Write-Info "다음 명령어로 환경 변수를 설정하세요:"
    Write-Host ""
    Write-Host "  `$env:$($targetConfig.EnvVarName) = 'postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres'" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

Write-Info "대상 환경: $($targetConfig.Description)"
Write-Info "DB URL: $($dbUrl.Substring(0, 30))..."

# Supabase CLI 확인
try {
    $null = supabase --version
    Write-Success "Supabase CLI 감지됨"
} catch {
    Write-Err "Supabase CLI가 설치되어 있지 않습니다."
    Write-Info "설치: npm install -g supabase"
    exit 1
}

# 마이그레이션 파일 확인
$migrationsPath = Join-Path $PSScriptRoot "..\supabase\migrations"
$migrations = Get-ChildItem -Path $migrationsPath -Filter "*.sql" | Sort-Object Name

Write-Host ""
Write-Info "적용할 마이그레이션 파일: $($migrations.Count)개"

foreach ($migration in $migrations) {
    Write-Host "  - $($migration.Name)" -ForegroundColor Gray
}

Write-Host ""

# DryRun 모드
if ($DryRun) {
    Write-Warn "DryRun 모드: 실제 적용되지 않습니다."
    exit 0
}

# 확인 프롬프트 (프로덕션인 경우)
if ($Target -eq "production") {
    Write-Warn "⚠️  프로덕션 환경에 마이그레이션을 적용하려고 합니다!"
    $confirm = Read-Host "계속하시겠습니까? (yes/no)"
    
    if ($confirm -ne "yes") {
        Write-Info "작업이 취소되었습니다."
        exit 0
    }
}

# 마이그레이션 적용
Write-Info "마이그레이션 적용 중..."

try {
    supabase db push --db-url $dbUrl
    Write-Success "마이그레이션이 성공적으로 적용되었습니다!"
} catch {
    Write-Err "마이그레이션 적용 실패: $_"
    exit 1
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor White
Write-Success "완료!"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor White
