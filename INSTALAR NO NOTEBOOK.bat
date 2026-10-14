@echo off
title Instalar o Claudinho
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo O Node.js ainda nao esta instalado. Instalando agora...
  echo Se perguntar se voce concorda, digite Y e aperte Enter.
  echo.
  winget install -e --id OpenJS.NodeJS.LTS
  echo.
  echo Node.js instalado. FECHE esta janela e abra este arquivo de novo.
  pause
  exit /b
)

echo Preparando o Claudinho...
call npm install --no-audit --no-fund

rem O cerebro do Claudinho e o Claude Code, usando a sua assinatura
where claude >nul 2>nul
if errorlevel 1 (
  echo Instalando o Claude Code...
  call npm install -g @anthropic-ai/claude-code --no-audit --no-fund
)

rem PowerToys traz o Mouse Without Borders (1 mouse e 1 teclado em 2 computadores)
winget list -e --id Microsoft.PowerToys >nul 2>nul
if errorlevel 1 (
  echo Instalando o PowerToys, para usar um mouse so nos dois computadores...
  winget install -e --id Microsoft.PowerToys
)

rem Chrome Remote Desktop: ver e mexer neste computador de longe (e daqui nos outros)
winget list -e --id Google.ChromeRemoteDesktopHost >nul 2>nul
if errorlevel 1 (
  echo Instalando o Chrome Remote Desktop...
  winget install -e --id Google.ChromeRemoteDesktopHost
)

rem Atalho "Claudinho Garagem" na area de trabalho (abre como aplicativo, sem janela preta)
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\Claudinho Garagem.lnk');$s.TargetPath='wscript.exe';$s.Arguments=[char]34+'%~dp0ABRIR CLAUDINHO.vbs'+[char]34;$s.WorkingDirectory='%~dp0';$s.IconLocation='%~dp0claudinho.ico';$s.Save()"

call claude auth status 2>nul | findstr /R /C:"loggedIn.: true" >nul
if errorlevel 1 (
  echo.
  echo Agora vai abrir o navegador: entre com a SUA conta do Claude.
  echo Quando aparecer que deu certo, volte aqui.
  call claude auth login
)

echo.
echo Pronto. Use o atalho "Claudinho Garagem" na area de trabalho.
pause
