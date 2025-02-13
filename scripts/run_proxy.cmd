if not DEFINED IS_MINIMIZED set IS_MINIMIZED=1 && start "" /min "%~dpnx0" %* && exit
       cmd.exe /c Powershell.exe -ExecutionPolicy ByPass -File "C:\testdriver-proxy\scripts\run_proxy.ps1"
exit
