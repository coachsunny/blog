# 心茶記 (Mind Tea Journal) · 註冊 Windows 工作排程器 (07:30 每日執行)
# 執行方式：在 PowerShell 以系統管理員或一般使用者執行：powershell -ExecutionPolicy Bypass -File .\scripts\register_windows_task.ps1

$TaskName = "MindTeaJournal_Daily_Autonomous"
$NodePath = (Get-Command node).Source
$ScriptPath = "d:\blog\scripts\daily_autonomous_service.js"
$WorkingDir = "d:\blog"

Write-Host "=== 註冊心茶記每日自動守護排程 (07:30 AM) ===" -ForegroundColor Cyan
Write-Host "Node.js 路徑: $NodePath"
Write-Host "腳本路徑: $ScriptPath"

# 建立每日 07:30 觸發器
$Trigger = New-ScheduledTaskTrigger -Daily -At 7:30AM

# 建立執行動作 (以無頭安靜模式執行 node)
$Action = New-ScheduledTaskAction -Execute $NodePath -Argument "$ScriptPath" -WorkingDirectory $WorkingDir

# 設定設定值 (允許喚醒電腦執行、失敗重試)
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -WakeToRun -StartWhenAvailable

# 檢查是否已存在舊排程，存在則先移除
$ExistingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($ExistingTask) {
    Write-Host "發現舊有排程，正在更新..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# 註冊新排程
Register-ScheduledTask -TaskName $TaskName -Trigger $Trigger -Action $Action -Settings $Settings -Description "心茶記每日清晨 07:30 自動預備發文與 Telegram 手機推送服務"

Write-Host "`n🎉 排程註冊成功！" -ForegroundColor Green
Write-Host "任務名稱: $TaskName"
Write-Host "每日執行時間: 清晨 07:30"
Write-Host "運作方式: 即使關閉 Antigravity 視窗，系統亦會在 07:30 自動於後台啟動並推送簡報至您的 Telegram！"
