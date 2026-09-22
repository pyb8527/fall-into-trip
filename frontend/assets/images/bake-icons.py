# -*- coding: utf-8 -*-
"""
손글씨 워드마크를 아이콘 그림으로 굽습니다.

획이 가늘어서 그냥 찍으면 작은 아이콘(64px)에서 사라집니다. 채우기 둘레에
같은 색 선을 한 겹 둘러 두께를 조금 보탭니다 — 글꼴 파일은 안 건드리고
그림만 두껍게 그리는 것입니다(라이선스가 금하는 것은 <파일>의 수정입니다).
"""
from PIL import Image, ImageDraw, ImageFont

FONT = "D:/dev/works/beenie/fall-into-trip/frontend/assets/fonts/LeeSeoyun.ttf"
ROOT = "D:/dev/works/beenie/fall-into-trip/frontend/"
MARK = "FIT"

SPECS = [
    # 이름, 한 변, 바탕(없으면 투명), 글자색, 글자가 차지할 폭 비율, 선 굵기 비율
    ("assets/images/icon.png", 1024, (14, 14, 14, 255), (255, 255, 255, 255), 0.60, 0.030),
    ("assets/images/favicon.png", 64, (14, 14, 14, 255), (255, 255, 255, 255), 0.66, 0.045),
    # 시작 화면은 흰 바탕 위에 얹힙니다(app.json). 그림 자체는 투명으로 둡니다.
    ("assets/images/splash-icon.png", 1024, None, (14, 14, 14, 255), 0.66, 0.028),
    # 안드로이드는 동그랗게 잘라 냅니다. 가운데 66% 안에 들어와야 안 잘립니다.
    ("assets/images/android-icon-foreground.png", 1024, None, (255, 255, 255, 255), 0.46, 0.030),

    # ---------------------------------------------------------------- 웹(PWA)
    #
    # 여기를 한동안 빠뜨리고 있었습니다. 글꼴을 바꾸며 위의 넷만 다시 굽고
    # 이 셋은 옛 디자인 그대로 두었는데, 홈 화면에 설치한 웹 앱은 시작 화면을
    # 안드로이드가 <매니페스트의 512 아이콘 + 배경색>으로 직접 만듭니다.
    # 그래서 앱 아이콘은 새 글씨인데 시작 화면만 옛 글씨인 상태가 됐습니다.
    #
    # 굽는 자리를 하나로 둡니다. 다음에 또 바꿀 때 한쪽만 굽는 일이 없도록.
    ("public/icons/icon-192.png", 192, (14, 14, 14, 255), (255, 255, 255, 255), 0.62, 0.035),
    ("public/icons/icon-512.png", 512, (14, 14, 14, 255), (255, 255, 255, 255), 0.62, 0.030),
    # maskable 은 어떤 모양으로 잘려도 괜찮아야 합니다. 안전한 자리는 가운데
    # 원 안쪽이라 위의 것들보다 더 작게 씁니다.
    ("public/icons/icon-maskable-512.png", 512, (14, 14, 14, 255), (255, 255, 255, 255), 0.46, 0.030),
]

# 크게 그려서 줄입니다. 선을 둘러 그린 가장자리가 그래야 매끈합니다.
SS = 4


def fit_size(size, want_w):
    """글자 폭이 want_w 가 되는 글꼴 크기를 찾습니다."""
    lo, hi = 8, size * 4
    while lo < hi:
        mid = (lo + hi + 1) // 2
        f = ImageFont.truetype(FONT, mid)
        w = f.getbbox(MARK)[2] - f.getbbox(MARK)[0]
        if w <= want_w:
            lo = mid
        else:
            hi = mid - 1
    return lo


for name, size, bg, fg, fill, bold in SPECS:
    big = size * SS
    img = Image.new("RGBA", (big, big), bg if bg else (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    fs = fit_size(big, big * fill)
    font = ImageFont.truetype(FONT, fs)

    # 글자 상자의 실제 크기로 가운데를 잡습니다. anchor 만 믿으면 글꼴마다
    # 위아래가 쏠립니다.
    x0, y0, x1, y1 = d.textbbox((0, 0), MARK, font=font)
    px = (big - (x1 - x0)) / 2 - x0
    py = (big - (y1 - y0)) / 2 - y0

    d.text((px, py), MARK, font=font, fill=fg,
           stroke_width=max(1, round(fs * bold)), stroke_fill=fg)

    img = img.resize((size, size), Image.LANCZOS)
    img.save(ROOT + name, optimize=True)
    print("구움", name, size, "글꼴", fs // SS)
