# Keep one trading engine running (Dagu DAG safezone-engine, every 5 min; replaces the disabled task SafezoneStocks).
# The engine is its own supervisor (restarts its child); this only starts it when no real engine runs. A --dry engine
# shares trades.jsonl and state.json, so it is stopped by PID before the real one starts.
$dir = Split-Path -Parent $PSScriptRoot
$all = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'engine\.mjs' }
$real = $all | Where-Object { $_.CommandLine -notmatch '--dry|--login' }
if ($real) { "engine running: pid $(@($real.ProcessId) -join ',')"; exit 0 }
# without a session the engine runs dry, feeds the stream and opens the login window by itself (engine.mjs no_session)
foreach ($p in ($all | Where-Object { $_.CommandLine -match '--dry' })) { Stop-Process -Id $p.ProcessId -Force; "stopped dry engine $($p.ProcessId)" }
$p = Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' -ArgumentList 'engine.mjs' -WorkingDirectory $dir -WindowStyle Hidden -PassThru
"engine started: pid $($p.Id)"
