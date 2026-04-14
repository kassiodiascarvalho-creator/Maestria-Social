@echo off
title Maestria Social — WhatsApp
echo.
echo  ================================================
echo   Maestria Social — WhatsApp Multi-Instancia
echo  ================================================
echo.

cd /d "%~dp0"

if not exist "node_modules" (
  echo  Instalando dependencias (aguarde)...
  npm install
  echo.
)

echo  [1/2] Abrindo servidor Baileys...
start "Baileys Server" cmd /k "cd /d %~dp0 && node server.js"

echo  Aguardando servidor iniciar (4s)...
timeout /t 4 /nobreak >nul

echo  [2/2] Abrindo tunel ngrok...
start "Ngrok Tunnel" cmd /k "cd /d C:\Users\kassi\Downloads\ngrok-v3-stable-windows-amd64 && ngrok http 3001 --domain=spender-reshape-unviable.ngrok-free.dev"

echo.
echo  Tudo iniciado! Duas janelas abertas:
echo   - Baileys Server: QR code aparece la dentro
echo   - Ngrok: tunel publico ativo
echo.
echo  Acesse o Maestria Social para ver o QR code na tela!
echo.
timeout /t 6 /nobreak >nul