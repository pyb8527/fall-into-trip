# -*- coding: utf-8 -*-
"""
시안에서 받은 아이콘 묶음을 저장소 자리에 넣습니다.

받은 것이 이미 크기별로 다 있어서 굽는 일은 거의 없습니다. 다만 두 가지만
여기서 만듭니다.

· 안드로이드 적응형 아이콘의 앞면 — 받은 것은 432 라, 1024 로 올리면 가장자리가
  뭉갭니다. 1024 짜리 심볼을 캔버스의 40% 로 다시 얹습니다(받은 432 의 비율
  그대로). 안드로이드가 가운데 66% 만 남기고 잘라 내므로 그 안에 들어와야
  합니다.
· 알림 아이콘 — 안드로이드는 알파만 보고 제 색으로 칠합니다. 흰 심볼이
  그대로 쓰입니다.
"""
import os
import shutil
from PIL import Image

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "icons", "FIT_icons")
DST = "D:/dev/works/beenie/fall-into-trip/frontend"

# 안드로이드가 잘라 낸 뒤에도 남는 자리. 받은 432 짜리와 같은 비율입니다.
FOREGROUND_FILL = 0.40


def put(src_rel, dst_rel):
    src = os.path.join(SRC, src_rel)
    dst = os.path.join(DST, dst_rel)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copyfile(src, dst)
    im = Image.open(dst)
    print(f"  {dst_rel:42s} <- {src_rel:46s} {im.size} {im.mode}")


def foreground(dst_rel, size=1024):
    """흰 심볼을 투명 캔버스 가운데에 얹습니다."""
    sym = Image.open(os.path.join(SRC, "symbol/fit-symbol-white-1024.png")).convert("RGBA")
    bb = sym.split()[3].getbbox()
    sym = sym.crop(bb)

    want = int(size * FOREGROUND_FILL)
    ratio = want / max(sym.size)
    sym = sym.resize((max(1, int(sym.width * ratio)), max(1, int(sym.height * ratio))),
                     Image.LANCZOS)

    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(sym, ((size - sym.width) // 2, (size - sym.height) // 2), sym)

    dst = os.path.join(DST, dst_rel)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    canvas.save(dst)
    print(f"  {dst_rel:42s} <- 심볼을 {FOREGROUND_FILL:.0%} 로 얹음              {canvas.size} RGBA")


print("앱 아이콘 — iOS 는 알파가 있으면 심사에서 걸립니다. 꽉 찬 것을 씁니다.")
put("ios/AppIcon-1024.png", "assets/images/icon.png")
put("ios/AppIcon-1024-dark.png", "assets/images/icon-dark.png")
put("ios/AppIcon-1024-tinted.png", "assets/images/icon-tinted.png")

print("\n안드로이드 적응형 — 바탕은 app.json 이 색으로 깝니다.")
foreground("assets/images/android-icon-foreground.png")

print("\n시작 화면 — 바탕은 바이올렛이고 심볼만 흰색으로 얹힙니다.")
put("symbol/fit-symbol-white-1024.png", "assets/images/splash-icon.png")

print("\n웹")
put("web/favicon-48.png", "assets/images/favicon.png")
put("web/icon-192.png", "public/icons/icon-192.png")
put("web/icon-512.png", "public/icons/icon-512.png")
put("web/maskable-512.png", "public/icons/icon-maskable-512.png")
put("web/apple-touch-icon.png", "public/icons/apple-touch-icon.png")
put("web/favicon.ico", "public/favicon.ico")

print("\n됐습니다.")
