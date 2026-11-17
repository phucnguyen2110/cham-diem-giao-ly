@echo off
setlocal
python "%~dp0serve-local.py"
if errorlevel 1 pause
