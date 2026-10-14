"""컴퓨터메이트 개발자 교육 슬라이드 생성기 (utonics-lecture-deck 디자인 토큰).

사용법: python3 training/scripts/build_deck.py
출력: training/deck/project/deck.json, training/deck/project/slides/<id>.html (claude.ai Slides 아티팩트 형식)
내용 원문: training/docs/draft.md(v0.2), training/docs/methodology.md, training/prompts/
업로드한 폰트·그림 주소: training/deck/assets.json
"""

import json
import re
from datetime import datetime, timezone
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "deck"
ASSETS = json.loads((ROOT / "assets.json").read_text(encoding="utf-8"))
IMG = ASSETS["images"]

NAVY, NAVY2 = "#17253F", "#1F3255"
LIGHT, LIGHT2 = "#F7F6F1", "#EDF0F5"
INK, BODY, MUTED, LINE = "#1B2431", "#3D4757", "#6B7280", "#D6DBE3"
ACC, ACC_TINT, ACC_TEXT = "#F0A429", "#FBEBCF", "#955A08"
CARD = "#FEFEFB"
CODE_BG, CODE_FG, CODE_CMT = "#1E2A3B", "#E6EDF3", "#9FB3C8"
ON_NAVY_SOFT, ON_NAVY_MUTED = "#BFC8D6", "#8A96AB"
SHADOW = "0px 2px 12px rgba(23,37,63,0.08)"

FONT = "'Freesentation 4 Regular', Arial, sans-serif"
BOLD = "font-family:'Freesentation 7 Bold', Arial, sans-serif; font-weight:400"
MONO = "'Source Code Pro', 'Courier New', monospace"
ORG = "㈜유토닉스 · 컴퓨터메이트 개발자 교육"

SECTIONS = [
    ("I", "방법론"),
    ("II", "마스터 프롬프트와 설계"),
    ("III", "프롬프트 여정"),
    ("IV", "자체 검증 루프"),
    ("V", "규칙·기록·실습"),
]

slides: list[tuple[str, object]] = []


def t(text: str) -> str:
    """이스케이프 + **굵게** → 굵은 서체 span 대신 <b>, \\n → <br>."""
    out = escape(text, quote=False)
    parts = out.split("**")
    return "".join(f"<b>{p}</b>" if i % 2 else p for i, p in enumerate(parts)).replace("\n", "<br>")


def add(sid, render):
    slides.append((sid, render))


# ── 공통 조각 ────────────────────────────────────────────────


def footer(page, color=MUTED):
    return (
        f'<p style="position:absolute; left:128px; bottom:64px; width:1100px; font-size:24px; color:{color}">{ORG}</p>\n'
        f'  <p style="position:absolute; right:128px; bottom:64px; width:160px; text-align:right; font-size:24px; color:{color}">{page}</p>'
    )


def content(sid, sec, title, body, notes, bg=LIGHT):
    roman, name = SECTIONS[sec] if sec is not None else ("", "도입")
    eyebrow = f"{roman} · {name}" if roman else name

    def render(page):
        return f"""<section id="{sid}" data-transition="fade" style="background:{bg}; color:{BODY}; font-family:{FONT}; padding:96px 128px 160px; display:flex; flex-direction:column; gap:40px">
  <div style="display:flex; flex-direction:column; gap:12px">
    <p style="font-size:24px; {BOLD}; color:{ACC_TEXT}; letter-spacing:2px">{eyebrow}</p>
    <h2 style="font-size:60px; {BOLD}; color:{INK}; line-height:1.15">{t(title)}</h2>
  </div>
  {body}
  {footer(page)}
  <aside>{escape(notes, quote=False)}</aside>
</section>
"""

    add(sid, render)


def p(text, size=28, color=BODY, extra=""):
    return f'<p style="font-size:{size}px; color:{color}; line-height:1.45{extra}">{t(text)}</p>'


def h3(text, size=34, color=INK):
    return f'<h3 style="font-size:{size}px; {BOLD}; color:{color}; line-height:1.25">{t(text)}</h3>'


def row(*cols, gap=32, align="stretch"):
    return f'<div style="display:flex; flex-direction:row; gap:{gap}px; align-items:{align}">{"".join(cols)}</div>'


def col(*parts, flex=1, gap=24):
    return f'<div style="flex:{flex}; display:flex; flex-direction:column; gap:{gap}px">{"".join(parts)}</div>'


def card(title, body, accent=False, size=26, title_size=32, extra=""):
    stripe = ACC if accent else NAVY
    body_html = body if body.startswith("<") else p(body, size)
    return (
        f'<div style="flex:1; display:flex; flex-direction:column; gap:14px; background:{CARD}; '
        f'border-top:6px solid {stripe}; border-radius:12px; padding:32px 36px; box-shadow:{SHADOW}{extra}">'
        f"{h3(title, title_size)}{body_html}</div>"
    )


def cards(items, accent_first=False, size=26, title_size=32, gap=24):
    return row(*[card(a, b, accent_first and i == 0, size, title_size) for i, (a, b) in enumerate(items)], gap=gap)


def circle(label, size=52, font=26, bg=ACC, fg=NAVY):
    return (
        f'<p style="width:{size}px; height:{size}px; border-radius:50%; background:{bg}; color:{fg}; '
        f'font-size:{font}px; {BOLD}; text-align:center; line-height:{size}px">{label}</p>'
    )


def steps(items, title_size=30, desc_size=26, gap=24):
    """items: (제목, 설명)"""
    cols = []
    for i, (title, desc) in enumerate(items):
        cols.append(
            f'<div style="flex:1; display:flex; flex-direction:column; gap:12px">{circle(str(i + 1))}'
            f'<h3 style="font-size:{title_size}px; {BOLD}; color:{INK}; line-height:1.2">{t(title)}</h3>'
            f'<p style="font-size:{desc_size}px; color:{BODY}; line-height:1.4">{t(desc)}</p></div>'
        )
    return f'<div style="display:flex; flex-direction:row; gap:{gap}px">{"".join(cols)}</div>'


def list_rows(items, main_size=30, detail_size=26):
    """세로 번호 목록: (제목, 설명)"""
    rows = []
    for i, (main, detail) in enumerate(items):
        rows.append(
            f'<div style="display:flex; flex-direction:row; align-items:center; gap:24px; background:{CARD}; '
            f'border-radius:12px; padding:14px 28px; box-shadow:{SHADOW}">{circle(str(i + 1), size=44, font=24)}'
            f'<div style="flex:1; display:flex; flex-direction:column; gap:2px">'
            f'<h3 style="font-size:{main_size}px; {BOLD}; color:{INK}; line-height:1.25">{t(main)}</h3>'
            f'<p style="font-size:{detail_size}px; color:{BODY}; line-height:1.35">{t(detail)}</p></div></div>'
        )
    return f'<div style="display:flex; flex-direction:column; gap:14px">{"".join(rows)}</div>'


def table(headers, rows, widths, size=26, key_col=False):
    head = "".join(
        f'<th style="width:{w}%; text-align:left; color:{LIGHT}; {BOLD}; padding:12px 18px">{escape(h)}</th>'
        for h, w in zip(headers, widths)
    )
    body_rows = []
    for r, values in enumerate(rows):
        bg = LIGHT2 if r % 2 else CARD
        cells = []
        for c, v in enumerate(values):
            color = f" color:{NAVY2};" if key_col and c == 0 else ""
            cells.append(f'<td style="text-align:left;{color}">{escape(v)}</td>')
        body_rows.append(f'<tr style="background:{bg}">{"".join(cells)}</tr>')
    return (
        f'<table style="width:100%; font-size:{size}px; color:{INK}; line-height:1.4">'
        f'<tr style="background:{NAVY}">{head}</tr>{"".join(body_rows)}</table>'
    )


def kv(rows, keyw=34, size=28):
    body_rows = []
    for r, (k, v) in enumerate(rows):
        bg = LIGHT2 if r % 2 else CARD
        w0 = f"width:{keyw}%; " if r == 0 else ""
        w1 = f"width:{100 - keyw}%; " if r == 0 else ""
        body_rows.append(
            f'<tr style="background:{bg}"><td style="{w0}text-align:left; color:{NAVY2}">{escape(k)}</td>'
            f'<td style="{w1}text-align:left">{escape(v)}</td></tr>'
        )
    return f'<table style="width:100%; font-size:{size}px; color:{INK}; line-height:1.4">{"".join(body_rows)}</table>'


def callout(label, text, size=28, stacked=False):
    if stacked:
        return (
            f'<div style="display:flex; flex-direction:column; gap:10px; background:{ACC_TINT}; '
            f'border-left:8px solid {ACC}; border-radius:8px; padding:22px 30px">'
            f'<p style="font-size:{size}px; {BOLD}; color:{INK}">{t(label)}</p>'
            f'<p style="font-size:{size}px; color:{INK}; line-height:1.4">{t(text)}</p></div>'
        )
    return (
        f'<div style="display:flex; flex-direction:row; align-items:center; gap:28px; background:{ACC_TINT}; '
        f'border-left:8px solid {ACC}; border-radius:8px; padding:22px 32px">'
        f'<p style="font-size:{size}px; {BOLD}; color:{INK}; white-space:nowrap">{t(label)}</p>'
        f'<div style="flex:1"><p style="font-size:{size}px; color:{INK}; line-height:1.4">{t(text)}</p></div></div>'
    )


def code(lines, size=24, label=None, flex=None):
    """코드 패널. 줄은 미리 나눠 넣는다(열 폭 58자, 전폭 80자 이내). 공백은 모두 &nbsp;로 보존.
    주석(// · /** */ 블록 · # 머리글)은 회색."""
    out = []
    in_block = False
    for line in lines:
        stripped = line.strip()
        starts_block = stripped.startswith("/**") or stripped.startswith("/*")
        is_comment = in_block or starts_block or stripped.startswith(("//", "#"))
        if starts_block and "*/" not in stripped:
            in_block = True
        elif in_block and "*/" in stripped:
            in_block = False
        nb = lambda s: escape(s, quote=False).replace(" ", "&nbsp;")
        if is_comment:
            html = f'<span style="color:{CODE_CMT}">{nb(line)}</span>'
        elif " //" in line:
            i = line.index(" //")
            html = nb(line[:i]) + f'<span style="color:{CODE_CMT}">{nb(line[i:])}</span>'
        else:
            html = nb(line) if line else "&nbsp;"
        out.append(html)
    flex_css = f"flex:{flex}; " if flex else ""
    label_html = f'<p style="font-size:24px; {BOLD}; color:{ACC}">{t(label)}</p>' if label else ""
    return (
        f'<div style="{flex_css}display:flex; flex-direction:column; gap:12px; background:{CODE_BG}; border-radius:14px; padding:30px 36px">'
        f"{label_html}"
        f'<p style="font-family:{MONO}; font-size:{size}px; color:{CODE_FG}; line-height:1.55">{"<br>".join(out)}</p></div>'
    )


def quote(text, source=None, size=40):
    src = f'<p style="font-size:26px; color:{MUTED}">{t(source)}</p>' if source else ""
    return (
        f'<div style="display:flex; flex-direction:column; gap:20px; background:{CARD}; border-left:10px solid {ACC}; '
        f'border-radius:12px; padding:44px 52px; box-shadow:{SHADOW}">'
        f'<p style="font-size:{size}px; {BOLD}; color:{INK}; line-height:1.45">“{t(text)}”</p>{src}</div>'
    )


def image(key, alt, w, h, radius=12, border=True):
    b = f" border:1px solid {LINE};" if border else ""
    return (
        f'<img src="{IMG[key]}" alt="{escape(alt, quote=True)}" '
        f'style="width:{w}px; height:{h}px; object-fit:contain; border-radius:{radius}px;{b}">'
    )


# ── 표지·섹션 표지·마무리 ───────────────────────────────────


def cover():
    def render(page):
        return f"""<section id="cover" data-transition="fade" style="background:{NAVY}; color:{LIGHT}; font-family:{FONT}; padding:128px; display:flex; flex-direction:column; justify-content:center; gap:28px">
  <img src="{IMG['C1']}" alt="FactoryTwin 전체 화면: 자재창고, 2개 생산라인, AGV, 출하 도크와 KPI 패널" style="position:absolute; left:960px; top:200px; width:832px; height:468px; object-fit:cover; border-radius:16px; opacity:0.92">
  <div style="width:120px; height:8px; background:{ACC}; border-radius:4px"></div>
  <p style="font-size:30px; {BOLD}; color:{ACC}; letter-spacing:2px">컴퓨터메이트 개발자 교육 · 2026.10</p>
  <h1 style="width:780px; font-size:84px; {BOLD}; color:{LIGHT}; line-height:1.18">Claude Code로 하는<br>바이브 코딩</h1>
  <p style="width:780px; font-size:38px; color:{ON_NAVY_SOFT}; line-height:1.4">스마트 팩토리 디지털 트윈을<br>만든 20개의 프롬프트</p>
  <p style="position:absolute; left:128px; bottom:96px; width:900px; font-size:28px; color:{ON_NAVY_MUTED}">㈜유토닉스</p>
  <aside>오늘은 완성품 설명이 아니라, 실제로 입력한 프롬프트를 처음부터 끝까지 순서대로 보여드립니다. 그 과정에서 쓴 작업 방식을 방법론으로 정리했고, 마지막에 여러분이 같은 방식으로 직접 해 봅니다.</aside>
</section>
"""

    add("cover", render)


def divider(sid, sec, subtitle, notes):
    roman, name = SECTIONS[sec]

    def render(page):
        nav = "".join(
            f'<p style="font-size:24px; {BOLD}; color:{ACC}; white-space:nowrap">{r} {n}</p>'
            if i == sec
            else f'<p style="font-size:24px; color:{ON_NAVY_MUTED}; white-space:nowrap">{r} {n}</p>'
            for i, (r, n) in enumerate(SECTIONS)
        )
        return f"""<section id="{sid}" data-transition="fade" style="background:{NAVY}; color:{LIGHT}; font-family:{FONT}; padding:128px 128px 160px; display:flex; flex-direction:column; justify-content:center; gap:24px">
  <p style="font-size:120px; {BOLD}; color:{ACC}; line-height:1.1">{roman}</p>
  <h1 style="font-size:84px; {BOLD}; color:{LIGHT}; line-height:1.15">{name}</h1>
  <p style="font-size:34px; color:{ON_NAVY_SOFT}">{t(subtitle)}</p>
  <div style="position:absolute; left:128px; bottom:64px; width:1664px; display:flex; flex-direction:row; gap:44px">{nav}</div>
  <aside>{escape(notes, quote=False)}</aside>
</section>
"""

    add(sid, render)


def closing():
    def render(page):
        blocks = [
            ("범위를 좁혀라", "로드맵은 전체를, 이번 일은 하나만"),
            ("재라", "테스트 통과에서 멈추지 말고 수치와 화면으로"),
            ("기록하라", "원문·결과·검증을 한 틀로 남겨 팀 자산으로"),
        ]
        bh = "".join(
            f'<div style="flex:1; display:flex; flex-direction:column; gap:12px; background:rgba(23,37,63,0.08); border-radius:16px; padding:32px 40px">'
            f'<h3 style="font-size:36px; {BOLD}; color:{NAVY}">{a}</h3>'
            f'<p style="font-size:28px; color:{NAVY}; line-height:1.45">{b}</p></div>'
            for a, b in blocks
        )
        return f"""<section id="closing" data-transition="fade" style="background:{ACC}; color:{NAVY}; font-family:{FONT}; padding:128px 128px 160px; display:flex; flex-direction:column; justify-content:center; gap:56px">
  <h1 style="font-size:76px; {BOLD}; color:{NAVY}; line-height:1.3">프롬프트는 시작일 뿐,<br>실력은 검증과 기록에서 나온다</h1>
  <div style="display:flex; flex-direction:row; gap:32px">{bh}</div>
  <p style="font-size:28px; color:{NAVY}">실습 자료 factory-twin-lab.zip · 실습 3은 1주 뒤 결과 공유</p>
  {footer(page, color=NAVY)}
  <aside>질의응답. 실습 3(기록하기)은 각자 업무 도메인으로 진행하고 1주 뒤 결과를 공유하는 것을 권한다.</aside>
</section>
"""

    add("closing", render)


# ── 슬라이드 ─────────────────────────────────────────────────


def build():
    cover()

    content(
        "result", None, "오늘의 결과물",
        row(
            image("C1", "FactoryTwin 운영 화면 전체", 1000, 562),
            col(
                kv([
                    ("운영 주소", "factory-twin-lemon.vercel.app"),
                    ("기술", "React 19 · React Three Fiber · TypeScript"),
                    ("규모", "소스·테스트 61개 파일, 약 6,500줄"),
                    ("검증", "테스트 22개 · 60 FPS(프로덕션)"),
                    ("이력", "커밋 6개 · 프롬프트 20건"),
                ], keyw=32, size=26),
                callout("사람이 한 일", "방향을 정하고, 결정하고, 확인했다", size=26, stacked=True),
                flex=1, gap=24,
            ),
            gap=40,
        ),
        "운영 주소를 열어 3분 시연: 전체 시점 → 설비 클릭 → 알람 → 구역 이동·필터 → 10배속. 이 코드는 사람이 한 줄도 직접 치지 않았다. 사람이 한 일은 방향을 정하고, 결정하고, 확인한 것이다.",
    )

    content(
        "journey", None, "하루, 20개의 프롬프트",
        steps([
            ("08:12 → 09:06", "애니메이션과 가상 데이터 (P01–05)"),
            ("09:34", "구역 선택·물류 KPI·필터 (P06–07)"),
            ("09:53", "코드 점검·최적화 (P08–09)"),
            ("16:37", "AGV 충전 구조 개선 (P10–11)"),
            ("17:10", "Vercel 운영 배포 (P12–14)"),
            ("19:52", "운영 버그·필터 끊김 수정 (P14–18)"),
        ], title_size=30, desc_size=26, gap=20)
        + callout("관찰", "첫 프롬프트부터 동작하는 화면과 데이터 처리까지 약 1시간. 시간이 든 곳은 검증과 개선이었다"),
        "시각은 2026-10-11 커밋 기록 기준. 오늘 강의의 무게중심도 검증과 개선에 있다.",
    )

    content(
        "takeaways", None, "오늘 가져갈 것 3가지",
        cards([
            ("방법론", "사람과 Claude Code의 역할을 나누는 10단계"),
            ("프롬프트", "템플릿을 번역하고, 위임하고, 설명부터 받는 문장들"),
            ("검증", "\"됐습니다\"를 믿지 않고 재는 습관"),
        ], accent_first=True, size=28, title_size=40),
        "세 가지를 실습 1(따라하기)·2(고쳐보기)·3(기록하기)과 연결해 예고한다.",
    )

    # I 방법론
    divider("div1", 0, "사람은 결정하고, AI는 만들고 검증한다", "방법론 파트. 이번 프로젝트에서 실제로 쓴 작업 방식만 근거로 정리했다.")

    content(
        "definition", 0, "한 문장 정의",
        quote("사람은 방향·범위·결정·승인을 맡고,\nClaude Code는 설계 제안·구현·검증·보고를 맡는다.\n둘 사이의 약속은 대화가 아니라 규칙 파일에 둔다.", "training/docs/methodology.md", size=40),
        "바이브 코딩은 '대충 맡기기'가 아니다. 결정과 확인은 끝까지 사람 몫이고, 그 기준을 규칙 파일로 고정한다.",
        bg=LIGHT2,
    )

    content(
        "loop", 0, "한 번의 반복",
        image("D3", "바이브 코딩 루프: 프롬프트, 질문과 결정, 구현, 자체 검증, 보고, 확인, 커밋과 푸시, 배포와 운영 확인", 1560, 600, border=False),
        "사람(주황)과 Claude Code(남색)의 차례를 짚는다. 이번 프로젝트는 이 루프를 6번 돌았고, 그 흔적이 커밋 6개다.",
    )

    content(
        "roles", 0, "역할 분담",
        table(
            ["사람", "Claude Code"],
            [
                ["무엇을 만들지, 이번에 어디까지 할지 정한다", "템플릿을 도메인에 맞게 번역하고 설계를 제안한다"],
                ["해석이 갈리는 결정을 내린다", "결정이 필요한 지점을 찾아 질문한다(추천안 표시)"],
                ["결과를 보고 커밋·배포 시점을 정한다", "구현하고, 테스트·측정·브라우저로 스스로 검증한다"],
                ["계정 권한이 필요한 일을 한다", "미검증은 \"미검증\"으로, 못 고친 것은 \"남긴 것\"으로 보고한다"],
            ],
            [50, 50], size=28,
        ),
        "저장소 생성, Vercel 연결처럼 계정 권한이 필요한 일은 사람이 직접 했다.",
    )

    content(
        "stages", 0, "방법론 10단계 지도",
        table(
            ["단계", "핵심", "프롬프트"],
            [
                ["0 준비", "워크트리 · CLAUDE.md · MCP", "—"],
                ["1 마스터 프롬프트", "로드맵 전체 + 이번 범위", "P01"],
                ["2 진행 중 교정", "작업 중 끼어들기, 참고 범위 지정", "P02"],
                ["3 위임과 결정 분리", "짧게 위임, 결정은 AI가 묻게", "P03, P06"],
                ["4 자체 검증 루프", "수치 · 대조 · A/B · 화면", "P01, P03, P11, P16"],
                ["5 체크포인트 커밋", "\"커밋하고 main에 올려 줘\"", "P04, P05, P07, P09, P15, P17"],
                ["6 독립 점검", "관점별 서브에이전트 리뷰", "P08"],
                ["7 설명 먼저", "구조 변경은 설명부터", "P10"],
                ["8 배포·운영 관찰", "운영 주소에서 재검증", "P12–P14"],
                ["9 마무리", "종료 · 정리 · 동기화", "P18"],
            ],
            [26, 42, 32], size=24, key_col=True,
        ),
        "오늘의 목차이기도 하다. II~IV 파트가 이 단계를 프롬프트 원문으로 하나씩 보여 준다.",
    )

    content(
        "setup", 0, "0단계: 시작 전에 깔아 두는 것",
        cards([
            ("워크트리", "작업마다 별도 브랜치·폴더.\n원본 폴더의 main은 건드리지 않는다"),
            ("CLAUDE.md", "완료 게이트 · 근본 원인 수정 · 범위 규율 · git 규칙 · 정직한 보고"),
            ("MCP 연결", "브라우저 자동화(Playwright)로 AI가 화면을 직접 띄워 확인"),
        ], size=28, title_size=36),
        "V 파트(규칙 파일 장)에서 교육용 규칙 예시를 다시 본다. 규칙이 없으면 '완료'의 기준이 매번 달라진다.",
    )

    content(
        "features", 0, "이번에 쓴 Claude Code 기능",
        table(
            ["기능", "쓴 곳", "효과"],
            [
                ["규칙 파일(CLAUDE.md)", "전 과정", "완료 기준·커밋 규칙을 매번 말하지 않음"],
                ["질문(AskUserQuestion)", "P06, P19", "해석이 갈리는 결정을 시작 전에 확정"],
                ["서브에이전트", "P08", "관점별 병렬 코드 리뷰"],
                ["스킬", "P03, P19", "차트 규칙·사내 강의 표준을 절차대로"],
                ["브라우저 자동화(Playwright)", "P01·03·06·08·14·16", "캡처·콘솔·FPS·클릭 검증"],
                ["백그라운드 작업", "개발 서버, P15·17", "배포를 기다렸다가 이어서 검증"],
                ["! 명령 · 워크트리 · gh·Vercel CLI", "P05·07·09 · 전 과정", "사람 명령 기록, 원본 보호, 원격·배포 확인"],
            ],
            [32, 24, 44], size=24, key_col=True,
        ),
        "이번 세션에서 실제로 쓴 기능만 적었다. 쓰지 않은 기능은 사례로 넣지 않았다.",
    )

    content(
        "phrases", 0, "자주 쓰는 문장",
        table(
            ["상황", "문장"],
            [
                ["시작", "\"전체는 이렇고, 우선 ○○부터 하자\""],
                ["참고 자료", "\"○○만 참조하고 △△는 따르지 마\""],
                ["위임", "\"○○는 너가 정해서 처리하자\""],
                ["다음 단계", "\"원래 프롬프트 N단계 진행하자\""],
                ["검증", "\"몇 시간 돌려서 이상치를 수치로 보여 줘\" / \"같은 조건으로 A/B 비교해 줘\""],
                ["구조 변경", "\"어떻게 해결할건지 설명해 줘\""],
                ["원인 불명", "\"재현 조건을 찾고, 못 찾으면 못 찾았다고 말해 줘\""],
                ["체크포인트 · 마무리", "\"커밋하고 main에 올려 줘\" · \"모두 종료하고 마무리하자\""],
            ],
            [24, 76], size=26, key_col=True,
        ),
        "이 표가 곧 오늘의 요약이다. 워크북 부록 B에 그대로 있다.",
    )

    # II 마스터 프롬프트와 설계
    divider("div2", 1, "로드맵을 주고, 범위는 좁혀라 · 방법론 1~3단계", "P01~P03. 출발점이 된 프롬프트 패턴과 첫 세 개의 프롬프트.")

    content(
        "pattern", 1, "출발점: 프롬프트 패턴 5요소",
        cards([
            ("Context", "무엇을 만드는지"),
            ("Goal", "지금 원하는 것"),
            ("Constraints", "도구와 규칙"),
            ("Output", "기대하는 결과물"),
            ("Verify", "스스로 확인시키기"),
        ], size=28, title_size=34, gap=20)
        + callout("출처", "해외 AI 코딩 튜토리얼의 프롬프트 패턴(원래 예시는 창고 관리 앱)"),
        "좋은 프롬프트는 길이가 아니라 이 다섯 칸이 채워졌는지로 판단한다. Verify가 빠지면 AI는 '됐다'고만 한다.",
    )

    content(
        "template5", 1, "원래 프롬프트는 5단계짜리 창고 관리 앱",
        table(
            ["단계", "원래 프롬프트(요약)"],
            [
                ["1 데이터 모델", "창고·도크·트럭·지게차·재고·출하 타입과 샘플 데이터"],
                ["2 3D 장면", "React Three Fiber, 전략 게임식 카메라, 그림자·격자 바닥"],
                ["3 클릭 검사", "클릭하면 강조·상세 패널, Zustand로 2초마다 갱신"],
                ["4 KPI·사이트·필터", "사이트 선택, 정시 배송률·도크 사용·운행 트럭·재고 부족"],
                ["5 점검·다듬기", "시니어처럼 리뷰, 인스턴싱, 60 FPS, 빌드·타입 체크, 새 기능 금지"],
            ],
            [28, 72], size=28, key_col=True,
        ),
        "우리는 이 템플릿을 그대로 쓰지 않았다. 다음 장부터 어떻게 '내 문제'로 바꿨는지 본다.",
    )

    content(
        "p01", 1, "P01 마스터 프롬프트",
        quote("아래 프롬프트를 참조하여 스마트공장을 보여주는 인터렉티브 애니메이션을 구현해 보자.\n나중에 데이터 연결과 처리 부분을 생각하고 우선 실제 공장 처럼 동작하는 애니메이션 구현부터 시작하고 싶다.", "+ 5단계 프롬프트 전문을 함께 붙여 넣음", size=36)
        + callout("방법론 1", "전체 5단계를 로드맵으로 주고, 이번 범위는 애니메이션으로 좁혔다"),
        "이 한 문장에 Context(스마트공장)·Goal(동작하는 애니메이션)·범위 제한(데이터는 나중)이 들어 있다. 원문의 띄어쓰기도 그대로 인용했다.",
        bg=LIGHT2,
    )

    content(
        "translate", 1, "템플릿을 우리 문제로 번역",
        table(
            ["원래(창고 앱)", "적용(스마트 팩토리)"],
            [
                ["사이트 3곳", "공장 1곳의 구역 6개"],
                ["트럭·지게차", "AGV 5대 + 출하 트럭"],
                ["정시 배송률", "납기 준수율"],
                ["도크 사용", "출하 도크 2개"],
                ["재고 부족", "원자재·투입 자재 부족 알람"],
                ["어두운 테마 + 앰버", "밝은 테마 유지(사람 결정)"],
            ],
            [40, 60], size=28, key_col=True,
        ),
        "프롬프트 템플릿은 그대로 붙여 넣는 순간 남의 문제를 풀게 된다. 이 번역을 AI가 제안했고, 사람은 확인하고 결정했다.",
    )

    content(
        "p02", 1, "P02 작업 중에 방향 바꾸기",
        quote("이미지 스타일만 참조하고 너가 구현할 수 있는 스마트 팩토리로 검토해 진행하자", "참고 이미지(다른 앱의 컨셉 화면)와 함께", size=40)
        + row(
            callout("방법론 2", "AI가 패키지 버전을 확인하던 중에 보낸 메시지. 진행 중 교정이 가장 싸다", size=26, stacked=True),
            callout("참고 범위", "무엇을 참고하고 무엇은 따르지 말지를 함께 준다", size=26, stacked=True),
            gap=28,
        ),
        "참고 이미지는 외부 영상의 컨셉 이미지라 교재에는 넣지 않았다. 결과적으로 밝은 아이소메트릭 장면, 흰 카드 UI, 파란 포인트 색으로 스타일만 가져왔다.",
        bg=LIGHT2,
    )

    content(
        "split", 1, "AI가 제안한 핵심 설계: 로직과 렌더링 분리",
        cards([
            ("시뮬레이터", "순수 TypeScript.\n화면과 무관하게 테스트 가능"),
            ("3D 장면", "매 프레임 상태를 읽기만.\nReact 리렌더 없이 60 FPS"),
            ("UI 패널", "초당 4번 스냅샷만 받음.\n패널이 장면을 느리게 하지 않음"),
        ], size=28, title_size=36)
        + callout("효과", "나중에 데이터 계층과 충전 구조를 바꿀 때 화면 코드를 거의 건드리지 않았다"),
        "사람이 지시한 구조가 아니라 AI가 제안했다. 이런 설계 제안을 받아들일지 판단하는 것이 사람의 몫이다.",
    )

    content(
        "flow", 1, "공장 흐름",
        image("D1", "공장 흐름: 자재창고에서 AGV, 생산라인 2개, AGV, 출하 도크까지. 아래에 AGV 순환로와 충전 베이", 1664, 600, border=False),
        "'실제 공장처럼'을 AI가 어떻게 해석했는지: 고장과 수리, 누적 컨베이어, 마모, AGV 예약과 충전.",
    )

    content(
        "p03", 1, "P03 데이터 위임",
        quote("데이터는 너가 임의로 발생하여 처리하자", None, size=34)
        + image("D2", "데이터 계층: 시뮬레이터, 가상 공장, 메시지 버스, 데이터 처리기, UI 패널. 3D 장면은 시뮬레이터를 직접 읽음", 1300, 484, border=False),
        "P01에서 '나중에 데이터 연결'을 예고해 둔 덕분에, 한 줄 위임이 실데이터로 교체 가능한 구조로 돌아왔다. 처리기는 메시지만 보고 계산한다.",
    )

    # III 프롬프트 여정
    divider("div3", 2, "P04부터 P18까지 · 방법론 3~9단계", "프롬프트 기록집(training/prompts/) 순서대로 본다.")

    content(
        "journey-a", 2, "여정 한눈에 (P01–P10)",
        table(
            ["번호", "프롬프트(원문 요약)", "단계", "커밋"],
            [
                ["P01", "마스터 프롬프트 — 애니메이션부터", "1", "4a6e234"],
                ["P02", "\"이미지 스타일만 참조하고 …\"", "2", "4a6e234"],
                ["P03", "\"데이터는 너가 임의로 발생하여 처리하자\"", "3", "4a6e234"],
                ["P04", "\"github에 등록하고 싶다. 이름을 추천해 줘\"", "5", "—"],
                ["P05", "\"… private 이다, , main에 합쳐서 올려 줘\"", "5", "4a6e234"],
                ["P06", "\"원래 프롬프트 4단계 진행하자\"", "3", "34dfdb0"],
                ["P07", "\"커밋하고 main에 올려 줘\"", "5", "34dfdb0"],
                ["P08", "\"원래 프롬프트 5단계 진행하자\"", "6", "3f8ba37"],
                ["P09", "\"커밋하고 main에 올려 줘\"", "5", "3f8ba37"],
                ["P10", "\"충전 정체를 어떻게 해결할건지 설명해 줘\"", "7", "—"],
            ],
            [10, 62, 10, 18], size=24,
        ),
        "원문은 오타·띄어쓰기도 고치지 않았다. 각 번호의 상세는 실습 자료의 prompts 폴더에 있다.",
    )

    content(
        "journey-b", 2, "여정 한눈에 (P11–P18)",
        table(
            ["번호", "프롬프트(원문 요약)", "단계", "커밋"],
            [
                ["P11", "\"추천 방안으로 하고 로컬의 브렌치도 머지하자.\"", "4", "e7c811c"],
                ["P12", "\"github를 vercel에 등록하면 화면이 나올까 ?\"", "8", "—"],
                ["P13", "\"vercel 유료 사용중이고 github와 연결되어 있다.\"", "8", "—"],
                ["P14", "\"1번으로 완료함\"", "8", "870b8f1"],
                ["P15", "\"네\"", "5", "870b8f1"],
                ["P16", "\"필터 첫 사용 시 끊김도 해결하자\"", "4", "70ad2da"],
                ["P17", "\"네\"", "5", "70ad2da"],
                ["P18", "\"모두 종료하고 마무리하자\"", "9", "—"],
            ],
            [10, 62, 10, 18], size=24,
        )
        + callout("사람이 직접 한 일", "GitHub 저장소 생성 · ! 명령으로 로컬 main 동기화 · Vercel 대시보드 Import", size=26),
        "짧은 승인('네')이 통한 것은 AI가 무엇을, 어디에, 어떤 부수 효과와 함께 할지 구체적으로 물었기 때문이다.",
    )

    content(
        "p06", 2, "P06 단계 호출과 AI의 질문",
        row(
            col(
                quote("원래 프롬프트 4단계 진행하자", None, size=34),
                table(
                    ["AI의 질문", "사람의 결정"],
                    [
                        ["'사이트 선택'을 어떻게 옮길까", "공장 내 구역 선택"],
                        ["어두운 테마 vs 밝은 테마", "밝은 테마 유지"],
                    ],
                    [58, 42], size=24,
                ),
                flex=5, gap=24,
            ),
            image("C7", "KPI 5개와 오더 탭 화면", 760, 428),
            gap=36,
        ),
        "단계 번호만으로 통한 이유: P01에서 전체 로드맵을 맥락으로 줬기 때문. 작업량이 크게 달라지는 결정(공장 1곳 vs 3곳)은 AI가 시작 전에 물었다.",
    )

    content(
        "tuning", 2, "숫자로 그럴듯함을 맞추기 (P06)",
        table(
            ["오더 간격", "납기 준수율(시드별)", "판단"],
            [
                ["130초", "100% 또는 20%", "수요≈능력, 극단적으로 갈림"],
                ["150초", "모두 100%", "지연이 없어 필터가 무의미"],
                ["210초(채택)", "0.75~1.00", "현실적인 범위"],
            ],
            [24, 34, 42], size=28,
        )
        + callout("함께 조정", "재고 부족 알림 15~44% → 0~11% · 오더 크기 2~6 → 2~8팔레트 · 납기 여유"),
        "시뮬레이션 데이터는 그럴듯함이 생명이다. AI가 여러 시드로 돌려 표를 만들고, 사람은 범위를 판단했다.",
    )

    content(
        "checkpoint", 2, "체크포인트 커밋 (P04·P05·P07)",
        steps([
            ("원격 확인", "원격이 앞서 있으면 멈춘다"),
            ("diff 검토", "대용량·시크릿·디버그 코드 grep"),
            ("커밋", "Conventional Commits + 한국어 설명"),
            ("푸시", "작업 브랜치는 그대로, 원격 main에"),
            ("동기화", "사람이 ! 명령으로 로컬 main pull"),
        ], title_size=30, desc_size=26)
        + callout("방법론 5", "커밋 시점은 사람이 정한다. 규칙 파일에 있어서 AI는 공개 범위·푸시 방식을 먼저 물었다(P04)"),
        "같은 문장('커밋하고 main에 올려 줘')을 반복해도 AI는 매번 원격 상태부터 다시 확인했다.",
    )

    content(
        "p08", 2, "P08 독립 점검",
        row(
            col(
                card("서브에이전트 ①", "시뮬레이션·데이터 로직", size=26, title_size=30),
                card("서브에이전트 ②", "3D 장면·UI·성능", size=26, title_size=30),
                callout("지시", "근거가 없으면 버려라", size=26),
                flex=2, gap=20,
            ),
            col(
                kv([
                    ("발견·수정한 버그", "12건"),
                    ("그리기 호출", "724 → 401 (−45%)"),
                    ("FPS", "60 (프로덕션 빌드)"),
                    ("느린 프레임", "1,203프레임 중 1"),
                    ("테스트", "20개 통과"),
                ], keyw=44, size=28),
                callout("측정 원칙", "성능은 프로덕션 빌드로 잰다", size=26),
                flex=3, gap=20,
            ),
            gap=36,
        ),
        "자기 코드 리뷰는 관대하다. 관점을 나눈 별도 에이전트에게 맡겼다. 개발 서버에서 보인 끊김은 개발 모드 React 탓이었다.",
    )

    content(
        "p10", 2, "P10 → P11 설명 먼저, 그다음 구현",
        row(
            col(
                quote("충전 정체를 어떻게 해결할건지 설명해 줘", None, size=34),
                kv([
                    ("원인", "충전소가 순환로 위에 있어 뒤 AGV가 막힘"),
                    ("효과(정직하게)", "운행 시간의 1.2~1.5% 수준"),
                    ("추천안", "순환로 밖 충전 베이(분기·합류)"),
                    ("대안", "기회 충전(적재·하역 중 충전)"),
                ], keyw=32, size=24),
                flex=3, gap=20,
            ),
            col(
                image("C5", "충전 베이에서 AGV 2대가 충전 중인 화면", 640, 360),
                callout("P11 결과", "충전 AGV 뒤 정체 859~1,081초 → 0초 · 본선 정체 −26% · 생산량·납기 변화 없음", size=24, stacked=True),
                flex=2, gap=20,
            ),
            gap=36,
        ),
        "구조를 바꾸는 작업은 설명부터 받는다. 원인, 대안 비교, 예상 효과, 검증 계획을 듣고 사람이 골랐다.",
    )

    content(
        "p12", 2, "P12–P14 배포와 운영 관찰",
        list_rows([
            ("\"github를 vercel에 등록하면 화면이 나올까 ?\"", "근거(잠금 파일의 Linux 바이너리·Node 버전) 확인 + \"미검증\" 표시"),
            ("\"vercel 유료 사용중이고 github와 연결되어 있다.\"", "방법 2가지 제시: 대시보드(추천) / CLI"),
            ("사람이 대시보드에서 Import", "계정 권한이 필요한 클릭은 사람이"),
            ("AI가 운영 주소 확인", "배포 번들 = 로컬 최신 빌드 · 0.4초 · 60 FPS · 오류 0"),
            ("운영에서만 보이는 버그 발견", "수정 → 자동 재배포 → 운영 주소 재확인"),
        ], main_size=28, detail_size=24),
        "배포 후에도 운영 주소로 다시 검증했다. 로컬에서 안 보이던 버그가 운영에서 나왔다(IV 파트 사례 5).",
    )

    content(
        "p18", 2, "P18 마무리 체크리스트",
        kv([
            ("백그라운드 작업", "개발 서버·측정용 서버 종료"),
            ("임시 파일", "측정 스크립트·캡처 삭제"),
            ("동기화", "작업 브랜치 · 로컬 main · 원격 main · 운영 배포 = 70ad2da"),
            ("남은 사항", "라이브러리 경고 1건, 저사양 기기 성능 미검증"),
        ], keyw=26, size=30)
        + callout("방법론 9", "세션을 닫을 때도 확인 목록이 있다"),
        "남은 사항을 마지막에 정직하게 남기는 것까지가 마무리다.",
    )

    # IV 자체 검증 루프
    divider("div4", 3, "AI 결과를 수치와 화면으로 · 방법론 4단계", "사례 6개. 모두 이번 프로젝트에서 실제로 일어난 일이다.")

    content(
        "principles", 3, "검증 3원칙",
        cards([
            ("완료 게이트", "테스트 → 타입 체크 → 빌드가 모두 통과해야 \"완료\""),
            ("수치로 확인", "통계 · 독립 대조 · 같은 조건의 A/B · 전후 측정"),
            ("실제 화면", "브라우저를 띄워 캡처·콘솔·클릭으로 확인"),
        ], accent_first=True, size=28, title_size=36)
        + callout("주의", "완료 게이트는 최소 조건이다. 그것만으로 버그가 다 잡히지 않는다"),
        "세 원칙을 규칙 파일에 고정해 두면 매번 말하지 않아도 된다.",
    )

    content(
        "case1", 3, "사례 1 (P01): 정류장을 지나치는 AGV",
        row(
            code([
                "/** 이 거리 안이면 '이미 지난 정류장'으로",
                "    보고 다음 정류장을 찾는다 */",
                "const STOP_PASSED = 1e-3",
                "/** 정차 예정 정류장까지 이 거리 안이면",
                "    도착 처리. STOP_PASSED보다 커야",
                "    정류장을 놓치지 않는다. */",
                "const STOP_ARRIVE = 0.02",
            ], size=24, label="src/sim/engine.ts", flex=3),
            col(
                callout("증상", "앞차 때문에 정류장 바로 앞에 멈추면 다음 틱에 '이미 지남'으로 판정 → 자재 예약이 묶이고 배터리 0%", size=24, stacked=True),
                callout("발견", "테스트는 통과. 2시간 통계에서 AGV-04만 운반 23회(다른 AGV 85~138회)", size=24, stacked=True),
                flex=2, gap=20,
            ),
            gap=32,
        ),
        "테스트 통과는 정상의 증거가 아니다. 경계값 두 개의 대소 관계가 원인이었다. 실습 2에서 이 버그를 직접 찾는다.",
    )

    content(
        "case2", 3, "사례 2 (P03): 100%는 의심하라",
        table(
            ["측정", "결과", "판단"],
            [
                ["첫 측정", "고장 36건 중 36건 사전 알람", "고장 알람 자체를 함께 센 측정 오류"],
                ["측정 순서 수정", "43건 중 22건(약 51%)", "나머지는 마모와 무관한 돌발 고장(설계대로)"],
            ],
            [24, 36, 40], size=28,
        )
        + callout("교훈", "너무 좋은 결과는 측정 방법부터 본다. AI가 스스로 측정 순서를 바꿔 다시 쟀다"),
        "예지 보전이 '고장 전에 알람이 먼저 뜨는가'를 잴 때의 일. 100%가 나오자 기뻐하기 전에 측정을 의심했다.",
    )

    content(
        "case3", 3, "사례 3 (P06): 흐림 효과가 안 보임",
        code([
            "// 불투명 재질은 알파를 무시하도록(OPAQUE) 컴파일되므로 셰이더를 다시 만들어야 투명도가 반영된다",
            "m.needsUpdate = true",
        ], size=24, label="src/scene/Dimmable.tsx")
        + row(
            callout("추적", "디버그 로그로 '실행됨(8회)'과 '화면 반영 안 됨'을 분리", size=26, stacked=True),
            callout("후속 P16", "첫 사용 셰이더 3개 → 미리 비동기 컴파일. 최대 프레임 35~39ms → 약 24ms", size=26, stacked=True),
            gap=28,
        ),
        "실행 여부와 결과를 분리해서 보는 디버깅 습관. 라이브러리 동작은 소스를 직접 확인시켰다.",
    )

    content(
        "case4", 3, "사례 4 (P11): 지표가 나빠졌다? 비교 조건부터",
        row(
            col(
                table(
                    ["비교", "수정 전", "수정 후"],
                    [
                        ["난수 공유(주문이 달라짐)", "0.891", "0.672"],
                        ["주문 난수 분리 후", "0.869", "0.864"],
                    ],
                    [50, 25, 25], size=26,
                ),
                callout("교훈", "A/B는 같은 입력에서만 의미가 있다", size=26),
                flex=1, gap=24,
            ),
            code([
                "/** 외부 입력(고객 주문·공급사 입고) 전용 난수.",
                "    공장 내부 동작이 바뀌어도 같은 시드면",
                "    같은 주문·입고가 들어온다 */",
                "private readonly demandRng: () => number",
            ], size=24, label="src/sim/engine.ts", flex=1),
            gap=32,
        ),
        "개선했더니 납기 준수율이 떨어진 것처럼 보였다. AI가 수정 전 코드를 따로 꺼내 시드 8개로 같은 조건 A/B를 만들었고, 실제 차이는 없었다.",
    )

    content(
        "case5", 3, "사례 5 (P14): 원인을 못 찾았을 때",
        row(
            code([
                "if (camera.position.distanceTo(start.position)",
                "      > USER_MOVE_THRESHOLD",
                "    || c.target.distanceTo(start.target)",
                "      > USER_MOVE_THRESHOLD) {",
                "  interaction.current = null",
                "  useFactoryStore.getState().clearArea()",
                "}",
            ], size=24, label="src/scene/CameraRig.tsx", flex=3),
            col(
                callout("증상", "카메라를 안 움직였는데 구역 선택이 풀림(운영 9번 중 2번)", size=24, stacked=True),
                callout("대응", "원인 신호를 특정하지 못했다고 보고 → 판단 기준을 '입력 시작'에서 '실제 이동'으로", size=24, stacked=True),
                flex=2, gap=20,
            ),
            gap=32,
        ),
        "증상 우회와 기준 수정의 차이를 토론한다. 못 찾은 것을 숨기지 않고 보고한 점이 핵심이다.",
    )

    content(
        "case6", 3, "사례 6 (P08): 리뷰 에이전트가 찾은 경계 조건",
        code([
            "// 경고·위험 구간을 오가도 '경고 이상'이 이어지면 대기 시간을 이어서 센다",
            "if (!t.pending) t.pending = { rank: target, since: ts }",
            "else if (target < t.pending.rank) t.pending.rank = target",
        ], size=25, label="src/platform/alarms.ts")
        + callout("증상", "값이 6.2와 5.0을 오가면 계속 경고 이상인데도 알람이 영영 안 뜸")
        + callout("발견", "단위 테스트가 놓친 경계 조건을 별도 리뷰 에이전트가 실험으로 증명"),
        "실습 2와 연결: 경계 조건은 사람도 AI도 놓친다. 관점을 나눠 다시 보게 하는 것이 해법이다.",
    )

    # V 규칙·기록·실습
    divider("div5", 4, "같은 방식으로 직접 · 규칙 → 기록 → 실습", "실습 자료(factory-twin-lab.zip)에 오늘 본 모든 것이 들어 있다.")

    content(
        "rules", 4, "팀 규칙 파일(CLAUDE.md) 예시",
        row(
            code([
                "## 완료 기준",
                "- 테스트 → 타입 체크(0 에러) → 빌드 성공 전에는",
                "  \"완료\"라고 하지 않는다",
                "## 수정 원칙",
                "- 원인을 고친다. 테스트를 건너뛰거나",
                "  주석 처리해 통과시키지 않는다",
                "- 요청한 것만 한다. 한 변경에 한 가지 목적",
                "## git",
                "- 작업 시작 시 git status 확인, feature 브랜치에서만",
                "- 커밋·푸시는 요청할 때만. 커밋 전 diff와 시크릿 확인",
                "## 보고",
                "- 확인 못 한 것은 \"미검증\", 고치지 않은 것은 \"남긴 것\"",
            ], size=24, label="CLAUDE.md (교육용 예시)", flex=3),
            col(
                callout("출처", "이번 작업에 실제로 적용된 전역 규칙을 교육용으로 다듬은 것", size=24, stacked=True),
                callout("쓰는 법", "팀 저장소 루트에 두면 모든 수강생의 Claude Code가 같은 기준을 쓴다", size=24, stacked=True),
                flex=2, gap=20,
            ),
            gap=32,
        ),
        "실습 zip의 CLAUDE.md가 이 내용이다. 각 팀 상황에 맞게 줄을 더하거나 빼서 쓴다.",
    )

    content(
        "record", 4, "프롬프트를 기록하라",
        row(
            code([
                "# NN. 제목",
                "## 원문            (고치지 않고 그대로)",
                "## 상황 · 의도",
                "## Claude Code가 한 일",
                "## 사람이 정한 것   (AI의 질문 → 결정)",
                "## 검증            (테스트·수치·화면)",
                "## 결과            (커밋·산출물)",
                "## 방법론 포인트",
                "## 교육용으로 다듬은 프롬프트",
                "## 메모 (추가·변경용)",
            ], size=24, label="prompts/00-template.md", flex=3),
            col(
                callout("오늘의 20건", "이 틀로 정리되어 실습 자료 prompts 폴더에 있다", size=24, stacked=True),
                callout("규칙", "원문은 고치지 않는다. 고칠 생각은 다듬은 프롬프트·메모 칸에", size=24, stacked=True),
                flex=2, gap=20,
            ),
            gap=32,
        ),
        "프롬프트 기록이 곧 팀 자산이다. 원문과 결과와 검증을 한 틀로 남기면 다음 프로젝트의 출발점이 된다.",
    )

    content(
        "lab", 4, "실습 안내",
        steps([
            ("준비 (10분)", "zip 풀기 → npm ci → npm run dev → npm test → Claude Code 로그인"),
            ("따라하기 (35분)", "프롬프트 5요소로 \"3라인 추가\""),
            ("고쳐보기 (35분)", "lab/bug-agv 브랜치에서 \"AGV 하나가 운반을 멈춘다\" 원인 찾기"),
            ("기록하기 (과제)", "내 도메인 마스터 프롬프트 → 실행 → 기록 3건 이상"),
        ], title_size=30, desc_size=26)
        + callout("완료 기준", "화면 확인 + 테스트·타입 체크·빌드 통과 + 워크북 기록"),
        "실습 시간은 예정이다. 막히면 단계 태그(step-1~step-5)로 이동해 이어서 한다.",
    )

    content(
        "lab-detail", 4, "실습 과제 상세",
        table(
            ["실습", "과제", "쓰는 방법론", "완료 기준"],
            [
                ["1 따라하기", "\"3라인 추가\"", "1 범위 · 4 검증 · 5 커밋", "화면에 3라인 · 라인별 생산량 비교 · 게이트 통과 · 로컬 커밋"],
                ["2 고쳐보기", "버그 브랜치 원인 찾기", "7 설명 먼저 · 4 수치 검증", "원인을 수치로 설명 · 수정 · 회귀 테스트"],
                ["3 기록하기", "내 도메인 디지털 트윈", "1~5 전체", "마스터 프롬프트 + 기록 3건 + 1단계 화면"],
            ],
            [16, 22, 26, 36], size=24, key_col=True,
        ),
        "실습 2는 증상만 준다. '설명해 줘'로 시작해 원인을 수치로 확인한 다음 고치게 한다.",
    )

    closing()
    return slides


def main():
    built = build()
    out = ROOT / "project"
    (out / "slides").mkdir(parents=True, exist_ok=True)
    order = []
    for page, (sid, render) in enumerate(built, start=1):
        (out / "slides" / f"{sid}.html").write_text(render(page), encoding="utf-8")
        order.append(sid)
    sections = {
        "intro": {"description": "도입: 결과물과 오늘의 여정", "start": "cover"},
        "s1": {"description": "I 방법론: 사람과 Claude Code의 역할을 나누는 10단계", "start": "div1"},
        "s2": {"description": "II 마스터 프롬프트와 설계: 로드맵을 주고 범위를 좁힌다", "start": "div2"},
        "s3": {"description": "III 프롬프트 여정: P04부터 P18까지", "start": "div3"},
        "s4": {"description": "IV 자체 검증 루프: 실제 사례 6개", "start": "div4"},
        "s5": {"description": "V 규칙·기록·실습", "start": "div5"},
    }
    index_path = out / "deck.json"
    if index_path.exists():
        deck = json.loads(index_path.read_text(encoding="utf-8"))
        deck["order"] = order
        deck["sections"] = sections
    else:
        deck = {
            "v": 4,
            "createdOnFiles": {"v": 1, "at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")},
            "lists": "css",
            "title": "Claude Code로 하는 바이브 코딩 — 컴퓨터메이트 개발자 교육",
            "cover": "cover",
            "order": order,
            "sections": sections,
            "faces": {
                "freesentation-4-regular": {"family": "Freesentation 4 Regular", "src": ASSETS["fonts"]["regular"]},
                "freesentation-7-bold": {"family": "Freesentation 7 Bold", "src": ASSETS["fonts"]["bold"]},
                "source-code-pro": {"family": "Source Code Pro", "href": "https://fonts.googleapis.com/css2?family=Source+Code+Pro:wght@400&display=swap"},
            },
            "designSystems": [],
        }
    index_path.write_text(json.dumps(deck, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{len(order)}장 생성")


if __name__ == "__main__":
    main()
