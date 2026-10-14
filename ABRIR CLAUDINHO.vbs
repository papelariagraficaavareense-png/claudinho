' Abre o Claudinho como aplicativo: servidor com vigia + janela propria do navegador.
Set sh = CreateObject("WScript.Shell")
Set fs = CreateObject("Scripting.FileSystemObject")
pasta = fs.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = pasta
If Not fs.FolderExists(pasta & "\data") Then fs.CreateFolder(pasta & "\data")

' Servidor com vigia: se parar, liga de novo sozinho. Se ja estiver rodando, o segundo sai sozinho.
sh.Run "cmd /c """ & pasta & "\vigia.bat""", 0, False
WScript.Sleep 2000

' Tela inteira, sem barra de endereco. Para sair: Alt+F4.
' Microfone e som liberados sem clique (so neste perfil, que so abre o Claudinho).
flags = " --app=http://localhost:8770 --start-fullscreen --no-first-run --use-fake-ui-for-media-stream --autoplay-policy=no-user-gesture-required"

' Chrome primeiro: o reconhecimento de fala dele (Google) e bem mais confiavel que o do Edge.
chrome = sh.ExpandEnvironmentStrings("%ProgramFiles%\Google\Chrome\Application\chrome.exe")
If Not fs.FileExists(chrome) Then chrome = sh.ExpandEnvironmentStrings("%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe")
If Not fs.FileExists(chrome) Then chrome = sh.ExpandEnvironmentStrings("%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe")

If fs.FileExists(chrome) Then
  perfil = sh.ExpandEnvironmentStrings("%LOCALAPPDATA%\ClaudinhoChrome")
  sh.Run """" & chrome & """" & flags & " --user-data-dir=""" & perfil & """", 1, False
Else
  perfil = sh.ExpandEnvironmentStrings("%LOCALAPPDATA%\ClaudinhoEdge")
  sh.Run "msedge" & flags & " --user-data-dir=""" & perfil & """", 1, False
End If
