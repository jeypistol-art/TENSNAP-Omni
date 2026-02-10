@echo off
copy "C:\Users\use\.gemini\antigravity\brain\6f4baf8d-2619-4431-8ff3-fb334d0b1c94\uploaded_media_0_1770084159724.png" "c:\Users\use\dev\score-snap\public\images\logo.png"
if %errorlevel% neq 0 (
    echo Copy failed with errorlevel %errorlevel% > copy_error.txt
) else (
    echo Copy succeeded > copy_success.txt
)
