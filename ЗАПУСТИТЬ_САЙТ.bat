@echo off
chcp 65001 >nul
title Запуск сайта Марина Герман

echo.
echo   ========================================
echo   Сайт запускается...
echo   Не закрывайте это окно
echo   ========================================
echo.

set "WEBSITE_DIR=%~dp0website"

if not exist "%WEBSITE_DIR%\" (
    echo Ошибка: папка website не найдена рядом с этим файлом.
    pause
    exit /b 1
)

cd /d "%WEBSITE_DIR%"

where npm >nul 2>&1
if errorlevel 1 (
    echo.
    echo Ошибка: Node.js не найден.
    echo Установите Node.js с сайта https://nodejs.org
    echo.
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo Устанавливаем зависимости, это может занять несколько минут...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo Ошибка: не удалось установить зависимости.
        pause
        exit /b 1
    )
    echo.
)

echo Запускаем сервер в отдельном окне...
start "Сервер сайта — не закрывайте" /D "%WEBSITE_DIR%" cmd /k "npm run dev"

echo Ожидаем запуск сервера (6 сек)...
timeout /t 6 /nobreak >nul

echo Открываем страницу распродажи в браузере...
start "" "http://localhost:3000/courses?sale=1"

echo.
echo   ========================================
echo   Готово! Сайт открыт в браузере.
echo.
echo   Не закрывайте это окно
echo   и окно "Сервер сайта".
echo   ========================================
echo.
pause
