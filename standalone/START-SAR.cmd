@echo off
setlocal
if defined SAR_NODE_EXE (
  "%SAR_NODE_EXE%" "%~dp0launch.mjs" %*
) else (
  node "%~dp0launch.mjs" %*
)
exit /b %errorlevel%
