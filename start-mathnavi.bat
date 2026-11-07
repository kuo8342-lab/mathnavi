@echo off
title MathNavi (local dev)
cd /d "%~dp0"

rem Already running? Just open the browser.
powershell -NoProfile -Command "try{(New-Object Net.Sockets.TcpClient('localhost',3000)).Close();exit 0}catch{exit 1}"
if %errorlevel%==0 (
  start "" http://localhost:3000/
  exit /b
)

if not exist node_modules (
  echo Installing dependencies for the first time...
  call npm install
)

rem Open the browser once the server responds.
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "for($i=0;$i -lt 60;$i++){try{Invoke-WebRequest http://localhost:3000/ -UseBasicParsing -TimeoutSec 30|Out-Null;break}catch{Start-Sleep 1}}; Start-Process http://localhost:3000/"

echo Starting MathNavi... close this window to stop it.
call npm run dev
