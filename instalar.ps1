# Instala (ou reinstala do zero) o Claudinho Garagem, baixando direto do GitHub.
# Uso no notebook (PowerShell):  irm https://raw.githubusercontent.com/papelariagraficaavareense-png/claudinho/main/instalar.ps1 | iex
$ErrorActionPreference = 'Stop'
$destino = Join-Path $env:USERPROFILE 'Documents\claudinho'

Write-Host ''
Write-Host '== Instalando o Claudinho Garagem ==' -ForegroundColor Cyan

if ($env:COMPUTERNAME -eq 'DIEGO') {
  Write-Host 'Este e o computador da grafica (DIEGO). Rode este comando no NOTEBOOK do Claudinho.' -ForegroundColor Yellow
  return
}

Write-Host '1/6 Fechando o Claudinho antigo...'
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'server\.js' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Start-Sleep -Seconds 1

Write-Host '2/6 Baixando a versao nova do GitHub...'
$zip = Join-Path $env:TEMP 'claudinho-main.zip'
$tmp = Join-Path $env:TEMP ('claudinho-' + (Get-Random))
Invoke-WebRequest 'https://codeload.github.com/papelariagraficaavareense-png/claudinho/zip/refs/heads/main' -OutFile $zip -UseBasicParsing
Expand-Archive $zip $tmp -Force
New-Item -ItemType Directory $destino -Force | Out-Null
Copy-Item (Join-Path $tmp 'claudinho-main\*') $destino -Recurse -Force

Write-Host '3/6 Conferindo o Node.js...'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
  $env:Path += ';' + "$env:ProgramFiles\nodejs" + ';' + "$env:APPDATA\npm"
}

Write-Host '4/6 Preparando as pecas do Claudinho (pode levar 1 minuto)...'
Set-Location $destino
& npm.cmd install --no-audit --no-fund
if (-not (Get-Command claude -ErrorAction SilentlyContinue)) { & npm.cmd install -g @anthropic-ai/claude-code --no-audit --no-fund }

Write-Host '5/6 Criando o atalho Claudinho Garagem...'
$mesa = [Environment]::GetFolderPath('Desktop')
Remove-Item (Join-Path $mesa 'Claudinho.lnk') -ErrorAction SilentlyContinue
$vbs = Join-Path $destino 'ABRIR CLAUDINHO.vbs'
$s = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $mesa 'Claudinho Garagem.lnk'))
$s.TargetPath = 'wscript.exe'
$s.Arguments = '"' + $vbs + '"'
$s.WorkingDirectory = $destino
$s.IconLocation = Join-Path $destino 'claudinho.ico'
$s.Save()

Write-Host '6/6 Abrindo o Claudinho...'
Start-Process wscript.exe ('"' + $vbs + '"')

Write-Host ''
Write-Host 'Pronto! Daqui pra frente ele se atualiza sozinho.' -ForegroundColor Green
