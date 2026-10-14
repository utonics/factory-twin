# 컴퓨터메이트 개발자 교육 자료 — Claude Code로 하는 바이브 코딩

스마트 팩토리 디지털 트윈(FactoryTwin)을 Claude Code로 만든 실제 과정을 교재로 만든 자료입니다.
반나절 4시간(강의 약 2시간 + 실습 약 2시간), 실습 도구는 Claude Code입니다.

## 산출물

| 산출물 | 위치 |
|---|---|
| 슬라이드(45장, Slides 아티팩트) | https://claude.ai/artifact/MLt7mMQPRw1LoTQezhT9vD (비공개: 공유 메뉴에서 공유해야 다른 사람이 열 수 있음) |
| 워크북(A4 11쪽) | `workbook/실습워크북.docx`, `workbook/실습워크북.pdf` |
| 실습 자료 | `dist/factory-twin-lab.zip` |
| 프롬프트 기록집(20건) | `prompts/` |
| 방법론 | `docs/methodology.md` |
| 슬라이드 초안·결정 기록 | `docs/draft.md`, `docs/decisions.md` |

## 폴더 구조

```
training/
├── docs/        초안(draft.md) · 방법론(methodology.md) · 결정 기록(decisions.md)
├── prompts/     프롬프트 기록집 01~20 + 00-template.md + README(목차·수정 방법)
├── images/      운영 화면 캡처(C1~C7)
├── diagrams/    다이어그램 SVG 원본 + PNG(D1 공장 흐름, D2 데이터 계층, D3 바이브 코딩 루프)
├── assets/      슬라이드용 폰트(Freesentation woff2)
├── deck/        슬라이드 파일(project/deck.json, project/slides/*.html) + 업로드 주소(assets.json)
├── workbook/    워크북 DOCX·PDF
├── dist/        실습 zip
└── scripts/     빌드 스크립트
```

## 다시 만들기

```bash
cd training
npm ci                                                   # sharp, docx

# 다이어그램: SVG 수정 후 PNG로
FONTCONFIG_FILE=$PWD/scripts/fonts.conf node scripts/render_diagrams.mjs

# 슬라이드: build_deck.py 수정 후 생성 → 바뀐 파일만 Slides 아티팩트에 다시 올림
python3 scripts/build_deck.py

# 워크북
node scripts/build_workbook.mjs
```

- 그림을 바꾸면 덱에 다시 업로드하고, 받은 `/_blob/<id>` 주소를 `deck/assets.json`에 고친 뒤 슬라이드를 다시 생성합니다.
- 슬라이드 문장·코드는 `prompts/`와 `docs/methodology.md`를 원문으로 씁니다. 원문을 고치면 해당 슬라이드와 워크북도 함께 고칩니다.
- 슬라이드의 코드 패널은 실제 소스와 글자가 같아야 합니다(줄바꿈 위치만 다를 수 있음).
