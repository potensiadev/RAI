"""
Srchd 데모 GIF - 랜딩페이지 최적화 (1440x810)
"""

import sys
import os
sys.path.insert(0, r'C:\Users\USER\.claude\plugins\cache\anthropic-agent-skills\example-skills\00756142ab04\skills\slack-gif-creator')

from core.gif_builder import GIFBuilder
from PIL import Image, ImageDraw, ImageFont

def get_font(size=14, bold=False):
    paths = [
        "C:/Windows/Fonts/malgunbd.ttf" if bold else "C:/Windows/Fonts/malgun.ttf",
        "C:/Windows/Fonts/malgun.ttf",
    ]
    for path in paths:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except:
                continue
    return ImageFont.load_default()

FONT_CACHE = {}
def font(size, bold=False):
    key = (size, bold)
    if key not in FONT_CACHE:
        FONT_CACHE[key] = get_font(size, bold)
    return FONT_CACHE[key]

C = {
    'bg': (250, 250, 252),
    'white': (255, 255, 255),
    'black': (29, 29, 31),
    'gray_100': (245, 245, 247),
    'gray_200': (229, 229, 234),
    'gray_300': (199, 199, 204),
    'gray_400': (142, 142, 147),
    'gray_500': (99, 99, 102),
    'gray_600': (72, 72, 74),
    'blue': (0, 122, 255),
    'blue_light': (230, 244, 255),
    'green': (52, 199, 89),
    'green_light': (232, 250, 238),
}

def rounded_rect(draw, box, r, fill=None, outline=None, width=1):
    x1, y1, x2, y2 = box
    if fill:
        draw.rectangle([x1+r, y1, x2-r, y2], fill=fill)
        draw.rectangle([x1, y1+r, x2, y2-r], fill=fill)
        draw.ellipse([x1, y1, x1+r*2, y1+r*2], fill=fill)
        draw.ellipse([x2-r*2, y1, x2, y1+r*2], fill=fill)
        draw.ellipse([x1, y2-r*2, x1+r*2, y2], fill=fill)
        draw.ellipse([x2-r*2, y2-r*2, x2, y2], fill=fill)
    if outline:
        draw.arc([x1, y1, x1+r*2, y1+r*2], 180, 270, fill=outline, width=width)
        draw.arc([x2-r*2, y1, x2, y1+r*2], 270, 360, fill=outline, width=width)
        draw.arc([x1, y2-r*2, x1+r*2, y2], 90, 180, fill=outline, width=width)
        draw.arc([x2-r*2, y2-r*2, x2, y2], 0, 90, fill=outline, width=width)
        draw.line([x1+r, y1, x2-r, y1], fill=outline, width=width)
        draw.line([x1+r, y2, x2-r, y2], fill=outline, width=width)
        draw.line([x1, y1+r, x1, y2-r], fill=outline, width=width)
        draw.line([x2, y1+r, x2, y2-r], fill=outline, width=width)

def ease_out_cubic(t):
    return 1 - pow(1 - t, 3)

def draw_progress_ring(draw, cx, cy, r, progress, color, bg_color, width=4):
    draw.ellipse([cx-r, cy-r, cx+r, cy+r], outline=bg_color, width=width)
    if progress > 0:
        start = -90
        end = start + (360 * progress)
        draw.arc([cx-r, cy-r, cx+r, cy+r], start, end, fill=color, width=width)

def create_demo():
    # 랜딩페이지 표시 크기에 정확히 맞춤
    W, H = 1440, 810
    FPS = 20
    FRAMES = 120

    builder = GIFBuilder(width=W, height=H, fps=FPS)

    candidate = {
        'file': '박지현_국문이력서.pdf',
        'name': '박지현',
        'position': 'Product Manager',
        'company': '쿠팡',
        'exp_years': '8년 2개월',
        'salary': '1.2억 (추정)',
        'education': '서울대 경영학과',
        'location': '서울 강남구',
        'match_score': 94,
        'skills': ['전략기획', '데이터분석', 'A/B테스트', 'SQL', 'Figma'],
        'career_summary': [
            ('쿠팡', 'Product Manager', '2021.03 - 현재'),
            ('네이버', 'PM', '2018.01 - 2021.02'),
            ('카카오', 'Associate PM', '2016.06 - 2017.12'),
        ],
        'strengths': ['대기업 PM 경력 8년', 'E-commerce 도메인 전문'],
    }

    # 레이아웃 (1440x810 최적화)
    MARGIN = 75
    GAP = 40
    CARD_W = (W - MARGIN * 2 - GAP) // 2
    CARD_TOP = 110
    CARD_H = H - CARD_TOP - 50
    PAD = 32

    for f in range(FRAMES):
        img = Image.new('RGB', (W, H), C['bg'])
        draw = ImageDraw.Draw(img)

        left_x = MARGIN
        right_x = MARGIN + CARD_W + GAP

        # 헤더
        draw.text((MARGIN, 35), "Srchd", fill=C['blue'], font=font(40, bold=True))

        if f < 24:
            # Phase 1: 파일 업로드
            t = ease_out_cubic(f / 24)

            rounded_rect(draw, [left_x, CARD_TOP, left_x + CARD_W, CARD_TOP + CARD_H], 24, fill=C['white'])

            icon_cy = CARD_TOP + CARD_H // 2 - 60 + int(40 * (1 - t))
            doc_w, doc_h = 90, 112
            doc_x = left_x + CARD_W // 2 - doc_w // 2

            draw.rectangle([doc_x, icon_cy, doc_x + doc_w, icon_cy + doc_h],
                          fill=C['gray_100'], outline=C['gray_300'], width=2)
            draw.polygon([(doc_x + 60, icon_cy), (doc_x + doc_w, icon_cy + 30), (doc_x + 60, icon_cy + 30)],
                        fill=C['gray_200'])
            draw.text((doc_x + doc_w // 2, icon_cy + 68), "PDF", fill=C['gray_500'], anchor="mm", font=font(22, bold=True))

            if t > 0.3:
                draw.text((left_x + CARD_W // 2, icon_cy + doc_h + 35), candidate['file'],
                         fill=C['black'], anchor="mt", font=font(24))

            if t > 0.6:
                draw.text((left_x + CARD_W // 2, icon_cy + doc_h + 72), "파일을 분석할 준비가 되었습니다",
                         fill=C['gray_500'], anchor="mt", font=font(18))

            if t > 0.8:
                btn_w, btn_h = 200, 52
                btn_x = left_x + CARD_W // 2 - btn_w // 2
                btn_y = icon_cy + doc_h + 115
                rounded_rect(draw, [btn_x, btn_y, btn_x + btn_w, btn_y + btn_h], 26, fill=C['blue'])
                draw.text((left_x + CARD_W // 2, btn_y + btn_h // 2), "분석 시작",
                         fill=C['white'], anchor="mm", font=font(22, bold=True))

        elif f < 72:
            # Phase 2: 분석 중
            t = (f - 24) / 48
            progress = ease_out_cubic(t)

            rounded_rect(draw, [left_x, CARD_TOP, left_x + CARD_W, CARD_TOP + CARD_H], 24, fill=C['white'])

            draw.text((left_x + PAD, CARD_TOP + PAD), candidate['file'], fill=C['black'], font=font(24, bold=True))

            ring_cx = left_x + CARD_W // 2
            ring_cy = CARD_TOP + CARD_H // 2
            draw_progress_ring(draw, ring_cx, ring_cy, 85, progress, C['blue'], C['gray_200'], width=10)

            pct = int(progress * 100)
            draw.text((ring_cx, ring_cy), f"{pct}%", fill=C['black'], anchor="mm", font=font(48, bold=True))

            status = ["문서 읽는 중...", "경력 정보 분석 중...", "스킬 추출 중...", "매칭 점수 계산 중..."]
            draw.text((ring_cx, ring_cy + 130), status[min(int(progress * 4), 3)],
                     fill=C['gray_500'], anchor="mt", font=font(20))

        else:
            # Phase 3: 결과 표시
            reveal = ease_out_cubic(min((f - 72) / 32, 1.0))

            # 왼쪽 카드
            rounded_rect(draw, [left_x, CARD_TOP, left_x + CARD_W, CARD_TOP + CARD_H], 24, fill=C['white'])

            draw.text((left_x + PAD, CARD_TOP + PAD), candidate['name'], fill=C['black'], font=font(36, bold=True))
            draw.text((left_x + PAD, CARD_TOP + PAD + 45), f"{candidate['position']} @ {candidate['company']}",
                     fill=C['gray_600'], font=font(20))

            # 매칭 점수
            badge_w, badge_h = 90, 42
            badge_x = left_x + CARD_W - PAD - badge_w
            rounded_rect(draw, [badge_x, CARD_TOP + PAD, badge_x + badge_w, CARD_TOP + PAD + badge_h], 21, fill=C['green_light'])
            draw.text((badge_x + badge_w // 2, CARD_TOP + PAD + badge_h // 2), f"{candidate['match_score']}%",
                     fill=C['green'], anchor="mm", font=font(24, bold=True))
            draw.text((badge_x + badge_w // 2, CARD_TOP + PAD + badge_h + 8), "매칭",
                     fill=C['gray_500'], anchor="mt", font=font(14))

            # 구분선
            line_y = CARD_TOP + 115
            draw.line([(left_x + PAD, line_y), (left_x + CARD_W - PAD, line_y)], fill=C['gray_200'], width=1)

            # 정보 그리드
            if reveal > 0.2:
                info_y = CARD_TOP + 135
                col1_x = left_x + PAD
                col2_x = left_x + CARD_W // 2 + 15

                draw.text((col1_x, info_y), "경력", fill=C['gray_500'], font=font(16))
                draw.text((col1_x, info_y + 24), candidate['exp_years'], fill=C['black'], font=font(22, bold=True))

                draw.text((col2_x, info_y), "예상 연봉", fill=C['gray_500'], font=font(16))
                draw.text((col2_x, info_y + 24), candidate['salary'], fill=C['black'], font=font(22, bold=True))

                draw.text((col1_x, info_y + 75), "학력", fill=C['gray_500'], font=font(16))
                draw.text((col1_x, info_y + 99), candidate['education'], fill=C['black'], font=font(22, bold=True))

                draw.text((col2_x, info_y + 75), "위치", fill=C['gray_500'], font=font(16))
                draw.text((col2_x, info_y + 99), candidate['location'], fill=C['black'], font=font(22, bold=True))

            # 스킬 태그
            if reveal > 0.5:
                skill_y = CARD_TOP + 320
                draw.text((left_x + PAD, skill_y), "핵심 스킬", fill=C['gray_500'], font=font(16))

                sx = left_x + PAD
                sy = skill_y + 30
                for skill in candidate['skills']:
                    tw = len(skill) * 16 + 28
                    if sx + tw > left_x + CARD_W - PAD:
                        sx = left_x + PAD
                        sy += 42
                    rounded_rect(draw, [sx, sy, sx + tw, sy + 36], 18, fill=C['blue_light'])
                    draw.text((sx + tw // 2, sy + 18), skill, fill=C['blue'], anchor="mm", font=font(16))
                    sx += tw + 10

            # AI 요약
            if reveal > 0.7:
                sum_y = CARD_TOP + 450
                draw.text((left_x + PAD, sum_y), "AI 분석 요약", fill=C['gray_500'], font=font(16))
                for i, s in enumerate(candidate['strengths']):
                    draw.text((left_x + PAD, sum_y + 30 + i * 28), f"• {s}", fill=C['gray_600'], font=font(18))

            # 오른쪽 카드: 경력
            if reveal > 0.3:
                rounded_rect(draw, [right_x, CARD_TOP, right_x + CARD_W, CARD_TOP + CARD_H], 24, fill=C['white'])

                draw.text((right_x + PAD, CARD_TOP + PAD), "경력 사항", fill=C['black'], font=font(26, bold=True))

                career_reveal = (reveal - 0.3) / 0.7
                cy = CARD_TOP + 100
                for i, (company, role, period) in enumerate(candidate['career_summary']):
                    if career_reveal < i / len(candidate['career_summary']):
                        break

                    dot_x = right_x + 52
                    draw.ellipse([dot_x - 8, cy + 12, dot_x + 8, cy + 28],
                                fill=C['blue'] if i == 0 else C['gray_300'])

                    if i < len(candidate['career_summary']) - 1:
                        draw.line([(dot_x, cy + 32), (dot_x, cy + 110)], fill=C['gray_200'], width=3)

                    tx = dot_x + 32
                    draw.text((tx, cy), company, fill=C['black'], font=font(24, bold=True))
                    draw.text((tx, cy + 32), role, fill=C['gray_600'], font=font(18))
                    draw.text((tx, cy + 58), period, fill=C['gray_400'], font=font(15))

                    cy += 125

        builder.add_frame(img)

    output = r'D:\RAI\public\demo-resume-analysis.gif'
    builder.save(output, num_colors=256, optimize_for_emoji=False)
    return output

if __name__ == "__main__":
    create_demo()
