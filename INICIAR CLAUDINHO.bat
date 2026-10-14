@echo off
title Claudinho
cd /d "%~dp0"
if not exist node_modules call npm install
rem Abre no Edge, que tem as vozes naturais de graca
start "" msedge http://localhost:8770
node server.js
pause
