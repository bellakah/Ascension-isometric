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

if not exist "node_modules" (
  echo.
  echo [1/2] Instalando dependencias pela primeira vez...
  call npm install
  if errorlevel 1 goto :error
) else (
  echo [1/2] Dependencias ja instaladas.
)

echo [2/2] Iniciando servidor local...
echo.
echo Jogo:   http://localhost:5173/
echo Editor: http://localhost:5173/editor.html
echo.
echo Para encerrar, pressione CTRL+C nesta janela.

start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 3; Start-Process 'http://localhost:5173/'"
call npm run dev -- --host 0.0.0.0
exit /b %errorlevel%

:error
echo.
echo [ERRO] Nao foi possivel preparar o projeto.
pause
exit /b 1
