# Статус выгрузки — запускайте когда удобно
$root = "e:\КУРСОР МАРИНА КУРС ГЕРМАН"
$log = Join-Path $root "export\videos\download_progress.log"
$mp4 = Get-ChildItem (Join-Path $root "export\videos\*.mp4") -EA SilentlyContinue
$lines = if (Test-Path $log) { Get-Content $log -Encoding UTF8 } else { @() }
$saved = ($lines | Select-String 'SAVED ').Count
$novid = ($lines | Select-String 'no video').Count
$fail = ($lines | Select-String ' FAIL|FATAL').Count
$done = ($lines | Select-String '=== DONE ===').Count -gt 0
$cur = ($lines | Select-String '\[\d+/184\]' | Select-Object -Last 1).Line
$gb = if ($mp4) { [math]::Round(($mp4 | Measure-Object Length -Sum).Sum/1GB, 2) } else { 0 }

Write-Host "=== СТАТУС ВЫГРУЗКИ ==="
Write-Host ("Видео-файлов: {0} ({1} ГБ)" -f $mp4.Count, $gb)
Write-Host ("Успешно сохранено (SAVED): {0}" -f $saved)
Write-Host ("Без видео: {0}" -f $novid)
Write-Host ("Ошибки: {0}" -f $fail)
Write-Host ("Уроков всего: 184")
Write-Host ("Текущий: {0}" -f $cur)
if ($done) { Write-Host "ГОТОВО: выгрузка завершена" } else { Write-Host "Статус: идёт скачивание..." }
Write-Host ("Сайт: http://localhost:3000")
