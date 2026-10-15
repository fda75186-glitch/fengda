@echo off
cd /d "%~dp0"
"%~dp0runtime\node.exe" "%~dp0tools\configure-tencent-ai.mjs" "%~dp0.env.ai.local.json"
if errorlevel 1 pause
