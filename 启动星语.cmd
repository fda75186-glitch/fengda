@echo off
"%~dp0runtime\node.exe" "%~dp0launch.mjs"
if errorlevel 1 pause
