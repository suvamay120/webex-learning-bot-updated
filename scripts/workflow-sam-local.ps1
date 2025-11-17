Param(
  [string]$InputPath = "src/shared/learners.json",
  [string]$SamPath = "C:\Users\user\AppData\Local\Python\pythoncore-3.14-64\Scripts\sam.exe"
)

Write-Host "[info] Using SAM at: $SamPath"
Write-Host "[info] Input: $InputPath"

$ErrorActionPreference = 'Stop'

$tmp = Join-Path (Get-Location) ".tmp"
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

function Invoke-SamJson {
  param(
    [string]$FunctionName,
    [string]$EventPath
  )
  $cmdOutput = & $SamPath local invoke $FunctionName -e $EventPath --env-vars env.json 2>&1
  # Extract last line that looks like JSON (single-line output)
  $jsonLine = ($cmdOutput | Where-Object { $_ -match '^\{.*\}$' } | Select-Object -Last 1)
  if (-not $jsonLine) {
    throw "No JSON output found from $FunctionName"
  }
  return $jsonLine
}

try {
  $inputFull = (Resolve-Path $InputPath).Path

  # Step 1: CheckAttendance
  Write-Host "[step] Invoking CheckAttendanceFunction"
  $checkJson = Invoke-SamJson -FunctionName "CheckAttendanceFunction" -EventPath $inputFull
  $checkPath = Join-Path $tmp "check.json"
  $checkJson | Out-File -FilePath $checkPath -Encoding utf8
  $checkObj = $checkJson | ConvertFrom-Json
  Write-Host ("[debug] CheckAttendance: count={0} activityStatus={1} daysThreshold={2}" -f ($checkObj.meta.count), ($checkObj.meta.activityStatus), ($checkObj.meta.daysThreshold))

  # Step 2: ReminderHandler
  Write-Host "[step] Invoking ReminderHandlerFunction"
  $composeJson = Invoke-SamJson -FunctionName "ReminderHandlerFunction" -EventPath $checkPath
  $composePath = Join-Path $tmp "compose.json"
  $composeJson | Out-File -FilePath $composePath -Encoding utf8
  $composeObj = $composeJson | ConvertFrom-Json
  $msgCount = ($composeObj.messages | Measure-Object).Count
  Write-Host ("[debug] ComposeMessages: requested={0} activityStatus={1} daysThreshold={2}" -f $msgCount, ($composeObj.meta.activityStatus), ($composeObj.meta.daysThreshold))

  # Step 3: EnqueueMessages (batch to SQS)
  Write-Host "[step] Invoking EnqueueMessagesFunction (batch to SQS)"
  $enqueueInputObj = [PSCustomObject]@{ messages = $composeObj.messages }
  $enqueueInputPath = Join-Path $tmp "enqueue_input.json"
  ($enqueueInputObj | ConvertTo-Json -Depth 10) | Out-File -FilePath $enqueueInputPath -Encoding utf8
  $enqueueJson = Invoke-SamJson -FunctionName "EnqueueMessagesFunction" -EventPath $enqueueInputPath
  $enqueueObj = $enqueueJson | ConvertFrom-Json
  Write-Host ("[debug] EnqueueMessages: enqueued={0}" -f ($enqueueObj.enqueued))

  $summary = [PSCustomObject]@{
    requested = $msgCount
    enqueued = $enqueueObj.enqueued
    note = "Messages are enqueued to SQS; delivery handled by NotificationHandler"
  }

  $summaryPath = Join-Path $tmp "summary.json"
  ($summary | ConvertTo-Json -Depth 10) | Out-File -FilePath $summaryPath -Encoding utf8
  Write-Host "[done] Summary written to: $summaryPath"
  ($summary | ConvertTo-Json -Depth 10)
}
catch {
  Write-Error $_.Exception.Message
  exit 1
}