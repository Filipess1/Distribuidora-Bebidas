@echo off
chcp 65001 >nul
title Distribuidora de Bebidas - Servidor PC e Celular
cls
echo ================================================================
echo   DISTRIBUIDORA DE BEBIDAS - Iniciando o sistema...
echo   (mantenha esta janela aberta enquanto usar o app)
echo ================================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERRO] O Node.js nao foi encontrado. Instale em https://nodejs.org e tente de novo.
  pause
  exit /b 1
)

:: Encerrar instancia anterior na porta 3000
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":3000 " 2^>nul ^| findstr "LISTENING"') do taskkill /PID %%a /F >nul 2>&1

:: Abrir o navegador depois de 2 segundos
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000"

node "%~dp0server.cjs"
pause
