"""Write a 32x32 Constructor C-mark favicon.ico. No Pillow."""
from __future__ import annotations

import math
import struct
from pathlib import Path

SIZE = 32
OUT = Path(__file__).resolve().parents[1] / "favicon.ico"


def main() -> None:
    img = [[(10, 10, 10, 255) for _ in range(SIZE)] for _ in range(SIZE)]

    def setp(x: int, y: int, rgb: tuple[int, int, int], a: int = 255) -> None:
        if 0 <= x < SIZE and 0 <= y < SIZE:
            img[y][x] = (rgb[0], rgb[1], rgb[2], a)

    for x in range(SIZE):
        for y in range(SIZE):
            dx = min(x, SIZE - 1 - x)
            dy = min(y, SIZE - 1 - y)
            if dx < 2 or dy < 2:
                setp(x, y, (232, 232, 232))
    for t in range(-70, 71):
        ang = math.radians(180 - t)
        cx, cy, rad = 14.5, 16.0, 8.2
        x = int(round(cx + rad * math.cos(ang)))
        y = int(round(cy + rad * math.sin(ang)))
        for ox in (-1, 0, 1):
            for oy in (-1, 0, 1):
                setp(x + ox, y + oy, (232, 232, 232))
    xor = bytearray()
    for y in range(SIZE - 1, -1, -1):
        for x in range(SIZE):
            r, g, b, a = img[y][x]
            xor += bytes((b, g, r, a))
    and_row = ((SIZE + 31) // 32) * 4
    mask = bytearray(and_row * SIZE)
    dib = struct.pack("<IiiHHIIiiII", 40, SIZE, SIZE * 2, 1, 32, 0, len(xor) + len(mask), 0, 0, 0, 0)
    img_bytes = dib + xor + mask
    entry = bytes((SIZE, SIZE, 0, 0, 1, 0)) + struct.pack("<HHII", 32, 1, len(img_bytes), 22)
    ico = struct.pack("<HHH", 0, 1, 1) + entry + img_bytes
    OUT.write_bytes(ico)
    print("wrote", OUT, len(ico))


if __name__ == "__main__":
    main()
