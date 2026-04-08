Write-Host "Collecting Android Logcat..."

adb logcat -d > full_log.txt

Write-Host "Filtering CubeOne logs..."

Select-String "com.cubeone.scan" full_log.txt > cubeone_log.txt

Write-Host "Extracting scanner diagnostics..."

Select-String "CubeOneScan" full_log.txt > scanner_report.txt

Write-Host "Generating AI analysis report..."

$log = Get-Content scanner_report.txt -Raw

$report = @"
AI SCANNER DIAGNOSTIC REPORT

Application: CubeOne Scan
Platform: Android CameraX + MLKit
Barcode Type: PDF417 (SA Driver Licence)

Tasks for AI Agent:
1. Confirm camera pipeline status
2. Confirm ImageAnalysis frame processing
3. Confirm MLKit barcode detection
4. Identify scanner failures
5. Recommend fixes

LOG DATA:
$log
"@

$report | Out-File ai_scanner_report.txt

Write-Host "Report created: ai_scanner_report.txt"