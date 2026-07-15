$root = $PSScriptRoot
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\backend'; bun run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\web-app'; bun run dev"
Write-Host "Started backend (:8787) and web-app (:5173) in new windows."
