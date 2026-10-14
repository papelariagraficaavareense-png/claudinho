@echo off
title Claude do Claudinho (deixe esta janela aberta)
cd /d "%~dp0"
rem Deixa o Claude deste notebook ligado e acessivel de longe (Remote Control),
rem pra conferir e cuidar do Claudinho sem ninguem precisar olhar a tela.
call claude --remote-control "Notebook garagem"
