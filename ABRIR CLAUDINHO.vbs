' Abre o Claudinho como aplicativo: servidor escondido + janela propria do Edge.
Set sh = CreateObject("WScript.Shell")
Set fs = CreateObject("Scripting.FileSystemObject")
pasta = fs.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = pasta
If Not fs.FolderExists(pasta & "\data") Then fs.CreateFolder(pasta & "\data")

' Servidor com vigia: se parar, liga de novo sozinho. Se ja estiver rodando, o segundo sai sozinho.
sh.Run "cmd /c """ & pasta & "\vigia.bat""", 0, False
WScript.Sleep 2000

' Tela inteira, sem barra de endereco nem cara de navegador. Para sair: Alt+F4 (ou F11 volta a janela).
' Microfone e som liberados sem clique (so neste perfil, que so abre o Claudinho).
' Perfil proprio do Edge: assim abre sempre numa janela nova (respeitando a tela cheia)
' e a permissao do microfone fica guardada so pro Claudinho.
perfil = sh.ExpandEnvironmentStrings("%LOCALAPPDATA%\ClaudinhoEdge")
sh.Run "msedge --app=http://localhost:8770 --start-fullscreen --no-first-run --use-fake-ui-for-media-stream --autoplay-policy=no-user-gesture-required --user-data-dir=""" & perfil & """", 1, False
