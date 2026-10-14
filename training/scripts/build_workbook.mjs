// 컴퓨터메이트 개발자 교육 실습 워크북(A4 DOCX) 생성기.
// 원문: ../docs/draft.md(v0.2) §4, ../docs/methodology.md, ../prompts/*.md
// 사용법(training 폴더에서): node scripts/build_workbook.mjs  →  workbook/실습워크북.docx

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  AlignmentType, BorderStyle, Document, Footer, Header, HeadingLevel, ImageRun, Packer, PageBreak, PageNumber,
  Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
} from 'docx'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'workbook', '실습워크북.docx')
const DOC_TITLE = 'Claude Code로 하는 바이브 코딩 — 실습 워크북'
const ORG = '㈜유토닉스 · 컴퓨터메이트 개발자 교육'

const FONT = '맑은 고딕'
const MONO = 'Consolas'
const NAVY = '17253F'
const ACC = 'F0A429'
const ACC_TEXT = '955A08'
const ACC_TINT = 'FBEBCF'
const LIGHT = 'EDF0F5'
const CODE_BG = '1E2A3B'
const CODE_FG = 'FFFFFF'
const MUTED = '6B7280'
const LINE = 'B8C0CC'
const MARGIN = 1134
const PAGE_WIDTH = 11906 - MARGIN * 2 // A4 본문 폭(DXA)

// ---------- 블록 헬퍼 ----------

const run = (text, options = {}) => new TextRun({ text, font: FONT, size: 20, ...options })

function para(text, options = {}) {
  const { bold, color, size, align, after = 100, before = 0, keepNext } = options
  return new Paragraph({
    alignment: align,
    keepNext,
    spacing: { after, before, line: 300 },
    children: [run(text, { bold, color, size })],
  })
}

function heading(text, level = 1) {
  const sizes = { 1: 32, 2: 24 }
  return new Paragraph({
    heading: level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
    keepNext: true,
    spacing: { before: level === 1 ? 240 : 180, after: 100 },
    border: level === 1 ? { bottom: { style: BorderStyle.SINGLE, size: 12, color: ACC, space: 4 } } : undefined,
    children: [run(text, { bold: true, size: sizes[level], color: NAVY })],
  })
}

function bullets(items) {
  return items.map((item) => new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { after: 60, line: 290 },
    children: [run(item)],
  }))
}

const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: LINE }
const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder }

function cell(text, width, options = {}) {
  const { fill, bold, color, size = 19 } = options
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders,
    shading: fill ? { type: ShadingType.CLEAR, fill, color: 'auto' } : undefined,
    margins: { top: 40, bottom: 40, left: 100, right: 100 },
    children: String(text).split('\n').map((line) => new Paragraph({
      spacing: { after: 0, line: 260 },
      children: [run(line, { bold, color, size })],
    })),
  })
}

function dxaOf(widths) {
  const dxa = widths.map((w) => Math.round((PAGE_WIDTH * w) / 100))
  dxa[dxa.length - 1] += PAGE_WIDTH - dxa.reduce((a, b) => a + b, 0)
  return dxa
}

/** widths: 본문 폭을 나눈 비율(합 100). rowHeight를 주면 손으로 적을 수 있게 행을 키운다. */
function table(headers, rows, widths, options = {}) {
  const { rowHeight, size } = options
  const dxa = dxaOf(widths)
  return new Table({
    width: { size: PAGE_WIDTH, type: WidthType.DXA },
    columnWidths: dxa,
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, dxa[i], { fill: NAVY, bold: true, color: 'FFFFFF', size })) }),
      ...rows.map((r, index) => new TableRow({
        cantSplit: true,
        height: rowHeight ? { value: rowHeight, rule: 'atLeast' } : undefined,
        children: r.map((value, i) => cell(value, dxa[i], { fill: !rowHeight && index % 2 ? LIGHT : undefined, size })),
      })),
    ],
  })
}

/** ☐ 열(6%) + 항목. extra: 추가 열 머리글(예: '메모') */
function checklist(items, extra) {
  if (extra) return table(['☐', '항목', extra], items.map((item) => ['☐', item, '']), [6, 64, 30])
  return table(['☐', '항목'], items.map((item) => ['☐', item]), [6, 94])
}

/** 손으로 적는 양식: [라벨, 힌트] → 2열, 행 높이 520 DXA(기록 틀처럼 촘촘해야 할 때만 rowHeight로 조정) */
function form(rows, labelWidth = 28, rowHeight = 520) {
  const dxa = dxaOf([labelWidth, 100 - labelWidth])
  return new Table({
    width: { size: PAGE_WIDTH, type: WidthType.DXA },
    columnWidths: dxa,
    rows: rows.map(([label, hint]) => new TableRow({
      cantSplit: true,
      height: { value: rowHeight, rule: 'atLeast' },
      children: [
        cell(label, dxa[0], { fill: LIGHT, bold: true }),
        cell(hint || '', dxa[1], { color: MUTED, size: 17 }),
      ],
    })),
  })
}

function callout(label, text) {
  return new Table({
    width: { size: PAGE_WIDTH, type: WidthType.DXA },
    columnWidths: [PAGE_WIDTH],
    rows: [new TableRow({
      cantSplit: true,
      children: [new TableCell({
        width: { size: PAGE_WIDTH, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: ACC_TINT, color: 'auto' },
        borders: {
          top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          left: { style: BorderStyle.SINGLE, size: 36, color: ACC },
        },
        margins: { top: 100, bottom: 100, left: 160, right: 120 },
        children: [new Paragraph({ spacing: { after: 0, line: 290 }, children: [run(`${label}  `, { bold: true }), run(text)] })],
      })],
    })],
  })
}

function codeBox(text) {
  return new Table({
    width: { size: PAGE_WIDTH, type: WidthType.DXA },
    columnWidths: [PAGE_WIDTH],
    rows: [new TableRow({
      cantSplit: true,
      children: [new TableCell({
        width: { size: PAGE_WIDTH, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: CODE_BG, color: 'auto' },
        borders: { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder },
        margins: { top: 70, bottom: 70, left: 140, right: 140 },
        children: text.split('\n').map((line) => new Paragraph({
          spacing: { after: 0, line: 228 },
          children: [new TextRun({ text: line || ' ', font: { ascii: MONO, eastAsia: FONT, hAnsi: MONO }, size: 17, color: CODE_FG })],
        })),
      })],
    })],
  })
}

/** 손글씨 기입선 n줄. 연속 문단 테두리는 Word가 한 상자로 묶으므로 표의 행 구분선으로 그린다. */
function writeLines(n) {
  const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
  const line = { style: BorderStyle.SINGLE, size: 4, color: LINE }
  return new Table({
    width: { size: PAGE_WIDTH, type: WidthType.DXA },
    columnWidths: [PAGE_WIDTH],
    rows: Array.from({ length: n }, () => new TableRow({
      cantSplit: true,
      height: { value: 440, rule: 'exact' },
      children: [new TableCell({
        width: { size: PAGE_WIDTH, type: WidthType.DXA },
        borders: { top: none, left: none, right: none, bottom: line },
        children: [new Paragraph({ children: [] })],
      })],
    })),
  })
}

function image(file, widthPx) {
  const data = fs.readFileSync(path.join(ROOT, file))
  const w = data.readUInt32BE(16)
  const h = data.readUInt32BE(20)
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [new ImageRun({ type: 'png', data, transformation: { width: widthPx, height: Math.round((widthPx * h) / w) } })],
  })
}

const gap = (after = 120) => new Paragraph({ spacing: { after }, children: [] })
const pageBreak = () => new Paragraph({ children: [new PageBreak()] })

function step(title, minutes, body) {
  return [new Paragraph({
    keepNext: true,
    spacing: { before: 150, after: 80 },
    children: [run(title, { bold: true, size: 22, color: NAVY }), run(minutes ? `   ${minutes}` : '', { color: MUTED, size: 18 })],
  }), ...body]
}

// ---------- 내용 ----------

const cover = [
  gap(1500),
  para('컴퓨터메이트 개발자 교육 · 반나절 4시간', { color: ACC_TEXT, bold: true, size: 22, after: 200 }),
  para('Claude Code로 하는 바이브 코딩', { bold: true, size: 56, color: NAVY, after: 120 }),
  para('스마트 팩토리 디지털 트윈을 만든 20개의 프롬프트 — 실습 워크북', { size: 26, color: '3D4757', after: 800 }),
  table(['항목', '내용'], [['성명', ''], ['소속', ''], ['실습일', ''], ['내 업무에서 만들고 싶은 디지털 트윈', '']], [35, 65], { rowHeight: 560 }),
  gap(400),
  callout('이 워크북은', '실습 단계, 기입할 프롬프트 양식, 검증 기록표, 프롬프트 기록 틀을 담고 있습니다. 실습 자료(factory-twin-lab.zip)와 함께 씁니다.'),
  gap(200),
  para('㈜유토닉스', { color: MUTED, size: 18 }),
  pageBreak(),
]

const intro = [
  heading('0. 실습 안내'),
  heading('완료 기준', 2),
  callout('완료', '화면 확인 + 테스트·타입 체크·빌드 통과 + 워크북 기록. 세 가지가 모두 채워져야 "완료"입니다.'),
  heading('시간표', 2),
  table(['시간', '구분', '내용'], [
    ['13:00–13:45', '강의', '도입 · I 방법론'],
    ['13:45–14:15', '강의', 'II 마스터 프롬프트와 설계'],
    ['14:15–14:25', '휴식', ''],
    ['14:25–15:05', '강의', 'III 프롬프트 여정 · IV 자체 검증'],
    ['15:05–15:15', '강의', 'V 팀 규칙 · 기록 · 실습 안내'],
    ['15:15–15:25', '휴식', ''],
    ['15:25–16:50', '실습', '0 준비(10) → 1 따라하기(35) → 2 고쳐보기(35) → 공유(5)'],
    ['16:50–17:00', '마무리', '실습 3 과제 안내 · 질의응답'],
  ], [20, 12, 68]),
  para('실습 시간(분)은 예정입니다. 실제 진행에 따라 강사가 조정합니다.', { color: MUTED, size: 18, before: 60 }),
  heading('준비물', 2),
  checklist(['Node.js 22 이상 (node -v로 확인)', 'Git', 'Claude Code 설치와 로그인', 'factory-twin-lab.zip (강사가 나눠 줌)'], '확인 메모'),
  heading('실습 0. 준비 (10분 예정)', 2),
  codeBox(['# zip을 푼 폴더에서', 'cd factory-twin-lab', 'npm ci', 'npm test', 'npm run dev        # 터미널에 나온 주소를 브라우저로 연다', 'claude             # 새 터미널에서 Claude Code 시작'].join('\n')),
  heading('실습 자료 구성', 2),
  table(['위치', '내용'], [
    ['LAB.md', '실습 안내(준비·과제·완료 기준·막혔을 때)'],
    ['CLAUDE.md', '교육용 팀 규칙'],
    ['prompts/', '프롬프트 기록집 20건 + 템플릿'],
    ['lab/01-follow.md · 02-fix.md · 03-record.md', '실습 1·2·3 카드'],
    ['git 태그 step-1 ~ step-5', '단계별 완성 지점(막히면 이동)'],
    ['브랜치 lab/bug-agv · lab/answer-line3', '실습 2 버그 상태 · 실습 1 예시 정답'],
  ], [40, 60]),
  heading('약속 두 가지', 2),
  callout('하나. 완료 게이트', '테스트 → 타입 체크(0 에러) → 빌드 성공 전에는 "완료"라고 하지 않습니다. AI의 "됐습니다"도 이 기준으로 확인합니다.'),
  gap(80),
  callout('둘. 기록', '입력한 프롬프트는 원문 그대로, 결과와 검증은 이 워크북에 적습니다. 기록이 다음 프로젝트의 출발점이 됩니다.'),
]

const method = [
  heading('방법론 한 장 요약'),
  callout('한 문장', '사람은 방향·범위·결정·승인을 맡고, Claude Code는 설계 제안·구현·검증·보고를 맡는다. 그리고 둘 사이의 약속(완료 기준·커밋 규칙·정직한 보고)은 대화가 아니라 규칙 파일에 둔다.'),
  gap(100),
  image('diagrams/D3-vibe-loop.png', 630),
  table(['단계', '핵심', '프롬프트'], [
    ['0 준비', '워크트리 · CLAUDE.md · MCP', '—'],
    ['1 마스터 프롬프트', '로드맵 전체 + 이번 범위', 'P01'],
    ['2 진행 중 교정', '작업 중 끼어들기, 참고 범위 지정', 'P02'],
    ['3 위임과 결정 분리', '짧게 위임, 결정은 AI가 묻게', 'P03, P06'],
    ['4 자체 검증 루프', '수치·대조·A/B·화면', 'P01, P03, P11, P16'],
    ['5 체크포인트 커밋', '"커밋하고 main에 올려 줘"', 'P04, P05, P07, P09, P15, P17'],
    ['6 독립 점검', '관점별 서브에이전트 리뷰', 'P08'],
    ['7 설명 먼저', '구조 변경은 설명부터', 'P10'],
    ['8 배포·운영 관찰', '운영 주소에서 재검증', 'P12–P14'],
    ['9 마무리', '종료·정리·동기화', 'P18'],
  ], [26, 44, 30]),
]

const part1 = [
  heading('1. 따라하기 — 3라인 추가 (35분 예정)'),
  para('카드: lab/01-follow.md. 쓰는 방법론 단계: M1 범위 · M4 검증 · M5 커밋', { color: MUTED, size: 18 }),
  para('레이아웃(src/data/factoryLayout.ts)에 생산 라인을 하나 더 추가합니다. 프롬프트 5요소를 채운 뒤 Claude Code에 입력합니다.'),
  ...step('1단계. 프롬프트 5요소 기입', '', [
    form([
      ['Context', '이 저장소가 무엇이고, 무엇을 바꾸려는지'],
      ['Goal', '지금 원하는 결과 한 가지'],
      ['Constraints', '지킬 것(기존 1·2라인과 테스트를 깨지 않기 등)'],
      ['Output', '받고 싶은 산출물(바뀐 파일 목록과 이유 등)'],
      ['Verify', 'AI가 스스로 확인할 방법(수치·게이트·화면)'],
    ], 22),
    gap(80),
    para('예시(그대로 써도 됩니다)', { bold: true, size: 18, color: NAVY, after: 60 }),
    codeBox([
      'Context: 이 저장소는 스마트 팩토리 디지털 트윈이다. 레이아웃은 src/data/factoryLayout.ts에 있다.',
      'Goal: 생산 라인을 하나 더(3라인) 추가하고 싶다.',
      'Constraints: 기존 1·2라인 동작과 테스트를 깨지 말 것. AGV 정류장도 추가할 것.',
      'Output: 바뀐 파일 목록과 이유.',
      'Verify: 2시간 시뮬레이션으로 라인별 생산량을 비교하고,',
      '        테스트·타입 체크·빌드 결과를 보여 줘.',
    ].join('\n')),
  ]),
  ...step('2단계. 결과 확인', '', [
    checklist([
      '화면에 3라인이 보인다',
      '공정 흐름 카드에 3라인 탭이 생겼다',
      'AI가 라인별 생산량 비교 수치를 보여 줬다',
      'npm test 통과',
      'npx tsc --noEmit 0 에러',
      'npm run build 성공',
    ], '내 결과'),
  ]),
  ...step('3단계. 라인별 생산량 전/후 기록', '', [
    table(['라인', '추가 전 생산량', '추가 후 생산량', '비고'], [['1라인', '', '', ''], ['2라인', '', '', ''], ['3라인', '—', '', ''], ['합계', '', '', '']], [16, 28, 28, 28], { rowHeight: 460 }),
    para('시뮬레이션 시간: ________ 시간 / 시드: ________', { before: 80 }),
  ]),
  ...step('4단계. 체크포인트', '', [
    para('결과를 확인했으면 "커밋해 줘"로 로컬 커밋을 남깁니다. 정답 예시는 브랜치 lab/answer-line3에서 비교해 볼 수 있습니다.'),
    form([['커밋 해시', ''], ['예시 정답과 다른 점', '']], 22),
  ]),
]

const part2 = [
  heading('2. 고쳐보기 — AGV 하나가 운반을 멈춘다 (35분 예정)'),
  para('카드: lab/02-fix.md. 쓰는 방법론 단계: M7 설명 먼저 · M4 수치 검증', { color: MUTED, size: 18 }),
  ...step('1단계. 버그 브랜치로 이동', '', [
    codeBox(['git switch lab/bug-agv', 'npm test', 'npm run dev        # 10배속으로 AGV 목록을 지켜본다'].join('\n')),
  ]),
  ...step('2단계. 증상 기록', '', [
    form([['언제(배속·시뮬레이션 시각)', ''], ['어느 AGV', ''], ['보이는 증상', '배터리·운반 횟수·상태 등'], ['다른 AGV와 다른 점', '']], 30),
  ]),
  ...step('3단계. "설명해 줘" 프롬프트 기입', '', [
    para('바로 고치게 하지 말고, 원인과 해결 방안부터 설명받습니다. 아래는 프롬프트 기록집 10번의 교육용 틀입니다.', { after: 60 }),
    codeBox([
      'Context: 점검에서 남긴 과제(<문제>)가 있다.',
      'Goal: 바로 고치지 말고 해결 방안을 설명해 달라.',
      'Output: 원인(코드 위치), 추천안과 대안 비교, 예상 효과(수치), 바뀌는 파일, 검증 계획.',
      'Constraints: 효과를 과장하지 않는다. 결정은 내가 한다.',
    ].join('\n')),
    gap(80),
    para('내가 입력한 프롬프트', { bold: true, size: 18, color: NAVY, after: 40 }),
    writeLines(4),
  ]),
  ...step('4단계. 가설과 측정', '', [
    table(['가설', '확인 방법(무엇을 재나)', '결과'], [['', '', ''], ['', '', ''], ['', '', '']], [36, 36, 28], { rowHeight: 560 }),
    gap(80),
    table(['측정 항목', '수정 전', '수정 후'], [['문제 AGV의 운반 횟수', '', ''], ['문제 AGV의 최저 배터리', '', ''], ['', '', '']], [40, 30, 30], { rowHeight: 460 }),
  ]),
  ...step('5단계. 원인과 수정', '', [
    form([['원인(코드 위치)', ''], ['수정 내용', ''], ['추가한 회귀 테스트 이름', ''], ['게이트 결과', '테스트 · 타입 체크 · 빌드']], 30),
  ]),
]

function recordFrame(n) {
  return [
    para(`기록 ${n}`, { bold: true, color: NAVY, size: 22, before: 100, after: 40, keepNext: true }),
    form([
      ['번호 · 제목', ''],
      ['원문', '입력한 프롬프트를 고치지 않고 그대로'],
      ['상황', '직전에 무엇이 끝났고, 왜 이 프롬프트를 썼는지'],
      ['Claude Code가 한 일', '사용한 기능 포함(질문·서브에이전트·스킬·MCP 등)'],
      ['사람이 정한 것', 'AI의 질문 또는 제안 → 나의 결정'],
      ['검증', '테스트·타입 체크·빌드, 측정 수치, 브라우저 확인'],
      ['결과(커밋)', ''],
      ['방법론 포인트', '이 프롬프트에서 배울 점'],
    ], 26, 400),
  ]
}

const part3 = [
  heading('3. 기록하기 — 내 도메인 디지털 트윈 (과제)'),
  para('카드: lab/03-record.md. 쓰는 방법론 단계: M1~M5 전체. 완료 기준: 마스터 프롬프트 + 기록 3건 + 1단계 화면', { color: MUTED, size: 18 }),
  ...step('1단계. 도메인 고르기 — 3기준', '', [
    checklist(['상태가 계속 바뀌는 대상이 있다(설비·차량·재고·서버 등)', '지금은 한눈에 보기 어렵다', '숫자로 확인할 지표가 있다(처리량·가동률·지연 등)'], '내 도메인에서'),
    form([['고른 도메인', '예: 물류센터, 데이터센터 서버룸, 매장']], 22),
  ]),
  ...step('2단계. 마스터 프롬프트 기입', '', [
    para('전체 로드맵(단계 목록)을 주고, 이번 범위는 좁힙니다.', { after: 60 }),
    form([
      ['전체 로드맵', '1단계 … / 2단계 … / 3단계 …'],
      ['Context', ''],
      ['Goal(이번 범위)', ''],
      ['Constraints', ''],
      ['Output', ''],
      ['Verify', ''],
    ], 22),
  ]),
  ...step('3단계. AI의 질문과 나의 답', '', [
    table(['AI의 질문 또는 제안', '나의 결정', '이유'], [['', '', ''], ['', '', ''], ['', '', ''], ['', '', '']], [44, 28, 28], { rowHeight: 520 }),
  ]),
  ...step('4단계. 프롬프트 기록 3건', '', [
    para('prompts/00-template.md와 같은 항목입니다. 원문은 고치지 않고, 고칠 생각은 메모로 따로 적습니다.', { after: 40 }),
    ...recordFrame(1),
    ...recordFrame(2),
    ...recordFrame(3),
  ]),
]

const appendixA = [
  pageBreak(),
  heading('부록 A. 오류 대응표'),
  table(['증상', '원인', '대응'], [
    ['npm ci에서 Unsupported engine 경고·실패', 'Node 버전이 낮음', 'node -v 확인 → Node 22 이상 설치 후 다시 npm ci'],
    ['npm run dev 후 다른 포트(5174 등)로 열림', '5173 포트를 다른 프로그램이 사용 중', '터미널에 표시된 주소로 접속, 또는 기존 개발 서버 종료'],
    ['화면이 비어 있거나 3D가 안 보임', '브라우저 WebGL 미지원·하드웨어 가속 꺼짐', '최신 Chrome에서 하드웨어 가속을 켜고 다시 열기'],
    ['claude 실행 시 로그인 안내', 'Claude Code 로그인 전', '안내에 따라 로그인 후 다시 실행'],
    ['파일 수정·명령 실행 권한을 묻는 창', 'Claude Code의 권한 확인', '무엇을 바꾸는지 읽고 허용. 모르면 "왜 필요한지 설명해 줘"'],
    ['git switch 시 local changes 오류', '커밋하지 않은 변경이 있음', '변경을 커밋한 뒤 브랜치 이동'],
    ['테스트 실패', '수정이 기존 동작을 깨뜨림', '테스트를 건너뛰지 말고 "실패 원인을 설명해 줘"'],
  ], [32, 28, 40], { size: 18 }),
  heading('부록 B. 자주 쓰는 문장', 2),
  table(['상황', '문장'], [
    ['시작', '"전체는 이렇고, 우선 ○○부터 하자"'],
    ['참고 자료', '"○○만 참조하고 △△는 따르지 마"'],
    ['위임', '"○○는 너가 정해서 처리하자"'],
    ['다음 단계', '"원래 프롬프트 N단계 진행하자"'],
    ['검증', '"몇 시간 돌려서 이상치를 수치로 보여 줘" / "같은 조건으로 A/B 비교해 줘"'],
    ['구조 변경', '"어떻게 해결할건지 설명해 줘"'],
    ['원인 불명', '"재현 조건을 찾고, 못 찾으면 못 찾았다고 말해 줘"'],
    ['체크포인트', '"커밋하고 main에 올려 줘"'],
    ['마무리', '"모두 종료하고 마무리하자"'],
  ], [22, 78], { size: 18 }),
  heading('검증 문장 (프롬프트 기록집의 Verify 원문)', 2),
  table(['기록', 'Verify'], [
    ['01', '시뮬레이션을 2시간 분량 돌려 이상치를 찾고, 테스트·타입 체크·빌드 결과와 브라우저 화면을 확인한 뒤 보고한다.'],
    ['03', '처리기 집계가 시뮬레이터 실제 값과 일치하는지 테스트로 대조하고, 몇 시간 분량을 돌려 알람이 고장보다 먼저 뜨는 비율을 측정한다.'],
    ['11', '같은 입력 조건으로 A/B 비교하고, 테스트·타입 체크·빌드·FPS를 확인한다.'],
    ['14', '배포 번들이 로컬 최신 빌드와 같은지, 콘솔 오류·FPS·주요 클릭 동작을 확인한다. 이상이 있으면 재현 조건을 찾고, 못 찾으면 그렇게 보고한다.'],
    ['16', '같은 측정 방법으로 전후를 비교하고, 수정이 다른 시점(시작 직후 등)에 새 문제를 만들지 않는지 확인한다.'],
  ], [10, 90], { size: 18 }),
]

const appendixC = [
  heading('부록 C. 명령어 치트시트'),
  table(['명령', '하는 일'], [
    ['git status', '바뀐 파일 확인(작업 시작 전 항상)'],
    ['git branch -a', '브랜치 목록'],
    ['git switch lab/bug-agv', '실습 2 버그 브랜치로 이동'],
    ['git tag', '단계 태그 목록(step-1 ~ step-5)'],
    ['git switch --detach step-3', '특정 단계 상태로 이동(막혔을 때)'],
    ['git log --oneline', '커밋 이력'],
    ['git diff', '커밋 전 변경 내용 검토'],
  ], [40, 60], { size: 18 }),
  gap(100),
  table(['명령', '하는 일'], [
    ['npm ci', '의존성 설치(잠금 파일 그대로)'],
    ['npm run dev', '개발 서버'],
    ['npm test', '테스트(Vitest)'],
    ['npx tsc --noEmit', '타입 체크(0 에러가 기준)'],
    ['npm run build', '타입 체크 + 프로덕션 빌드'],
  ], [40, 60], { size: 18 }),
  gap(100),
  table(['Claude Code', '하는 일'], [
    ['claude', '저장소 폴더에서 Claude Code 시작'],
    ['claude -c', '직전 대화 이어서 시작'],
    ['! <명령>', '대화창에서 셸 명령을 직접 실행(결과가 대화에 남음). 예: ! git status'],
    ['Esc', '진행 중인 작업 멈추기(방향을 바꿀 때)'],
    ['/help', '명령 목록 보기'],
  ], [30, 70], { size: 18 }),
  heading('부록 D. 완료 게이트 · 보안 체크리스트', 2),
  checklist([
    '테스트 통과',
    '타입 체크 0 에러',
    '빌드 성공',
    '화면에서 직접 확인(콘솔 오류 없음)',
    '커밋 전 git diff 검토',
    '.env·API 키 등 시크릿을 출력·커밋하지 않음',
    '실제 개인정보(이름·연락처 등)를 프롬프트·데이터에 넣지 않음',
    '외부 이미지·영상·글은 저작권 확인 후 사용(출처 표기)',
    '확인하지 못한 것은 "미검증"으로 기록',
  ]),
  heading('마무리 약속', 2),
  form([
    ['다음 주에 Claude Code로 해 볼 일', ''],
    ['팀에 공유할 프롬프트 기록 1건', ''],
    ['우리 팀 CLAUDE.md에 넣을 규칙 1가지', ''],
  ], 34),
]

// ---------- 문서 ----------

const doc = new Document({
  creator: '㈜유토닉스',
  title: DOC_TITLE,
  styles: { default: { document: { run: { font: FONT, size: 20 } } } },
  numbering: {
    config: [{
      reference: 'bullets',
      levels: [{ level: 0, format: 'bullet', text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 240 } } } }],
    }],
  },
  sections: [{
    properties: {
      titlePage: true,
      page: { size: { width: 11906, height: 16838 }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } },
    },
    headers: {
      default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [run(DOC_TITLE, { size: 16, color: MUTED })] })] }),
      first: new Header({ children: [new Paragraph({ children: [] })] }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [run(`${ORG}  ·  `, { size: 16, color: MUTED }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: MUTED })],
        })],
      }),
      first: new Footer({ children: [new Paragraph({ children: [] })] }),
    },
    children: [...cover, ...intro, ...method, ...part1, ...part2, ...part3, ...appendixA, ...appendixC],
  }],
})

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, await Packer.toBuffer(doc))
console.log(`생성: ${path.relative(ROOT, OUT)}`)
