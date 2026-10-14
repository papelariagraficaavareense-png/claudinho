@echo off
rem Vigia do Claudinho: se o servidor parar (erro, atualizacao, qualquer coisa), liga de novo em 3 segundos.
rem Se ja tiver outro Claudinho rodando, o servidor sai com codigo 3 e este vigia encerra.
cd /d "%~dp0"
if not exist data mkdir data
set CLAUDINHO_SUPERVISIONADO=1
:volta
node server.js >> data\servidor.log 2>&1
if %errorlevel%==3 exit /b
ping -n 4 127.0.0.1 >nul
goto volta
