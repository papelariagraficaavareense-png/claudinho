' Abre o Claudinho como aplicativo: servidor escondido + janela propria do Edge.
Set sh = CreateObject("WScript.Shell")
Set fs = CreateObject("Scripting.FileSystemObject")
pasta = fs.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = pasta
If Not fs.FolderExists(pasta & "\data") Then fs.CreateFolder(pasta & "\data")

' Se o servidor ja estiver rodando, este segundo sai sozinho (porta ocupada).
sh.Run "cmd /c node server.js >> data\servidor.log 2>&1", 0, False
WScript.Sleep 2000

' Tela inteira, sem barra de endereco nem cara de navegador. Para sair: Alt+F4 (ou F11 volta a janela).
sh.Run "msedge --app=http://localhost:8770 --start-fullscreen", 1, False
