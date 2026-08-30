@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Ascension Isometric

set "PNPM_VERSION=10.34.5"
set "GAME_URL=http://localhost:5173/"
set "EDITOR_URL=http://localhost:5173/editor.html"

echo.
echo ================================================
echo        ASCENSION ISOMETRIC - DEV STARTER
echo ================================================
echo.

rem ------------------------------------------------
rem 1. Validate Node.js/npm. We intentionally DO NOT
rem    run "corepack enable" because that tries to
rem    create pnpm.CMD inside Program Files and can
rem    fail with EPERM on normal Windows accounts.
rem ------------------------------------------------
where node >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Node.js nao foi encontrado.
  echo.
  echo Instale Node.js 22.12 ou superior e execute
  echo este arquivo novamente:
  echo https://nodejs.org/
  echo.
  pause
  exit /b 1
)

node -e "const [a,b]=process.versions.node.split('.').map(Number); process.exit(a>22 || (a===22 && b>=12) ? 0 : 1)"
if errorlevel 1 (
  echo [ERRO] Esta versao do Node.js e antiga:
  node -v
  echo.
  echo Instale Node.js 22.12 ou superior.
  echo https://nodejs.org/
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERRO] npm nao foi encontrado junto com o Node.js.
  echo Reinstale o Node.js e execute este arquivo novamente.
  pause
  exit /b 1
)

where npx >nul 2>nul
if errorlevel 1 (
  echo [ERRO] npx nao foi encontrado junto com o Node.js.
  echo Reinstale o Node.js e execute este arquivo novamente.
  pause
  exit /b 1
)

echo [OK] Node.js:
node -v
echo [OK] npm:
call npm --version

rem ------------------------------------------------
rem 2. Use a project-pinned pnpm through npx.
rem    npx stores it in the current user's npm cache,
rem    so no Administrator permission is required.
rem ------------------------------------------------
echo.
echo [1/4] Preparando pnpm %PNPM_VERSION% no cache do usuario...
call npx --yes pnpm@%PNPM_VERSION% --version
if errorlevel 1 goto :pnpm_error

rem ------------------------------------------------
rem 3. Install/sync every browser project dependency.
rem    Always use --no-frozen-lockfile locally. This
rem    lets pnpm repair an old lockfile left behind
rem    when the user updates/extracts a newer project
rem    version over an existing folder.
rem ------------------------------------------------
echo.
if not exist "node_modules" (
  echo [2/4] Primeira execucao detectada. Instalando tudo que o projeto precisa...
) else (
  echo [2/4] Verificando e atualizando dependencias do projeto...
)

if exist "pnpm-lock.yaml" (
  echo [INFO] Lockfile local encontrado. Ele sera sincronizado automaticamente.
)

call npx --yes pnpm@%PNPM_VERSION% install --no-frozen-lockfile
if errorlevel 1 goto :install_error

if not exist "node_modules\.bin\vite.cmd" (
  echo.
  echo [ERRO] A instalacao terminou, mas o Vite nao foi encontrado.
  echo Tente executar o start.bat novamente.
  pause
  exit /b 1
)

echo.
echo [3/4] Dependencias prontas.
echo [OK] Three.js, Vite, TypeScript, fflate e ferramentas de desenvolvimento instaladas.

rem ------------------------------------------------
rem 4. Start the browser development server.
rem ------------------------------------------------
echo.
echo [4/4] Iniciando servidor local...
echo.
echo Jogo:   %GAME_URL%
echo Editor: %EDITOR_URL%
echo.
echo O navegador sera aberto automaticamente.
echo Para encerrar o servidor, pressione CTRL+C nesta janela.
echo.

start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 3; Start-Process '%GAME_URL%'"
call npx --yes pnpm@%PNPM_VERSION% run dev -- --host 0.0.0.0
exit /b %errorlevel%

:pnpm_error
echo.
echo [ERRO] Nao foi possivel obter o pnpm %PNPM_VERSION%.
echo Verifique sua conexao com a internet e tente novamente.
echo Nenhuma permissao de Administrador deveria ser necessaria.
pause
exit /b 1

:install_error
echo.
echo [ERRO] Nao foi possivel instalar ou atualizar as dependencias do projeto.
echo Verifique sua conexao com a internet e tente novamente.
echo O starter ja permite atualizar automaticamente lockfiles antigos.
pause
exit /b 1
