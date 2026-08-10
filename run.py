import ctypes
from ctypes import wintypes
import time
 
INPUT_MOUSE = 0
MOUSEEVENTF_MOVE = 0x0001
ULONG_PTR = wintypes.WPARAM  # pointer-sized integer
 
class MOUSEINPUT(ctypes.Structure):
    _fields_ = [
        ("dx", wintypes.LONG),
        ("dy", wintypes.LONG),
        ("mouseData", wintypes.DWORD),
        ("dwFlags", wintypes.DWORD),
        ("time", wintypes.DWORD),
        ("dwExtraInfo", ULONG_PTR),
    ]
 
class _INPUTunion(ctypes.Union):
    _fields_ = [("mi", MOUSEINPUT)]
 
class INPUT(ctypes.Structure):
    _fields_ = [("type", wintypes.DWORD), ("u", _INPUTunion)]
 
SendInput = ctypes.windll.user32.SendInput
 
def move_mouse(dx, dy=0):
    inp = INPUT()
    inp.type = INPUT_MOUSE
    inp.u.mi = MOUSEINPUT(dx, dy, 0, MOUSEEVENTF_MOVE, 0, 0)
    SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT))
 
while True:
    move_mouse(1)
    time.sleep(0.1)
    move_mouse(-1)
    time.sleep(20)