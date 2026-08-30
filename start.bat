@echo off
setlocal
cd /d "%~dp0"
title Ascension Isometric

echo.
echo ================================================
echo        ASCENSION ISOMETRIC - DEV STARTER
echo ================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Node.js nao foi encontrado.
  echo Instale Node.js 22.12 ou superior e execute este arquivo novamente.
  echo https://nodejs.org/
  pause
  exit /b 1
)

node -e "const [a,b]=process.versions.node.split('.').map(Number); process.exit(a>22 || (a===22 && b>=12) ? 0 : 1)"
if errorlevel 1 (
  echo [ERRO] Esta versao do Node.js e antiga:
  node -v
  echo Instale Node.js 22.12 ou superior.
  pause
  exit /b 1
)

echo [OK] Node.js:
node -v

where corepack >nul 2>nul
if errorlevel 1 (
  echo.
  echo [ERRO] Corepack nao foi encontrado nesta instalacao do Node.js.
  echo Reinstale o Node.js 22 LTS com Corepack ou instale pnpm 10.34.5 manualmente.
  pause
  exit /b 1
)

echo.
echo [1/3] Preparando pnpm 10.34.5...
call corepack enable
if errorlevel 1 goto :error
call corepack prepare pnpm@10.34.5 --activate
if errorlevel 1 goto :error

echo [2/3] Instalando/verificando dependencias...
call pnpm install --no-frozen-lockfile
if errorlevel 1 goto :error

echo [3/3] Iniciando servidor local...
echo.
echo Jogo:   http://localhost:5173/
echo Editor: http://localhost:5173/editor.html
echo.
echo Para encerrar, pressione CTRL+C nesta janela.

start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 3; Start-Process 'http://localhost:5173/'"
call pnpm run dev -- --host 0.0.0.0
exit /b %errorlevel%

:error
echo.
echo [ERRO] Nao foi possivel preparar o projeto.
pause
exit /b 1
