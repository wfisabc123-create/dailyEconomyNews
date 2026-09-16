@echo off
title 경제 브리핑 대시보드
start "" "http://localhost:4177"
node "%~dp0server.js"
