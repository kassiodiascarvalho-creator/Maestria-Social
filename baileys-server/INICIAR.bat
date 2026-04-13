@echo off
echo.
echo  Maestria Social - Servidor Baileys
echo =====================================
echo.

cd /d "%~dp0"

if not exist "node_modules" (
  echo [1/2] Instalando dependencias (aguarde)...
  npm install
  echo.
)

echo [2/2] Iniciando servidor...
echo.
node server.js
pause
