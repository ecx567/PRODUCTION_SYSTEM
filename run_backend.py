"""
Launcher that captures both stdout and stderr from uvicorn.
"""
import subprocess, sys, os, time, signal

log = open(r"D:\sistema de producción\backend_captured.log", "w", buffering=1)
log.write(f"=== START {time.strftime('%Y-%m-%d %H:%M:%S')} ===\n")

proc = subprocess.Popen(
    [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--log-level", "debug"],
    cwd=r"D:\sistema de producción\backend",
    stdout=log,
    stderr=log,
)
print(f"PID: {proc.pid}")
with open(r"D:\sistema de producción\backend_launcher_pid.txt", "w") as f:
    f.write(str(proc.pid))

# Keep running until interrupted
try:
    proc.wait()
except KeyboardInterrupt:
    proc.terminate()
    proc.wait()
finally:
    log.write(f"=== EXIT {time.strftime('%Y-%m-%d %H:%M:%S')} code={proc.returncode} ===\n")
    log.close()
