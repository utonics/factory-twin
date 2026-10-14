---
id: 01
title: 마스터 프롬프트 — 스마트 팩토리 애니메이션부터 시작
phase: 1 마스터 프롬프트
commit: 4a6e234 (03번 결과와 함께 커밋)
---

# 01. 마스터 프롬프트 — 스마트 팩토리 애니메이션부터 시작

## 원문
> 아래 프롬프트를 참조하여 스마트공장을 보여주는 인터렉티브 애니메이션을 구현해 보자.
> 나중에 데이터 연결과 처리 부분을 생각하고 우선 실제 공장 처럼 동작하는 애니메이션 구현부터 시작하고 싶다.
>
> 전체 프롬프트는 아래와 같다.

함께 붙여 넣은 전체 프롬프트(해외 AI 코딩 튜토리얼의 프롬프트 패턴, 원문 그대로 · 마지막 영상 홍보 문장만 생략):

```text
THE PERFECT PROMPT PATTERN
Context: tell the model what you are building.
Goal: say exactly what you want right now.
Constraints: name the tools and the rules.
Output: describe the files you expect.
Verify: ask the model to check its own work.

STEP 0: CONCEPT IMAGE (use ChatGPT or Gemini, then attach the image to your first prompt)
Create a concept image of a 3D warehouse management app that looks like a real-time strategy game. Isometric camera, low-poly warehouse with loading docks, trucks, forklifts and shelving. Dark industrial UI with amber accents. A side panel with live status for the selected truck, and a top bar with KPI cards. 16:9, clean, polished, like a game screenshot.

PROMPT 1: DATA MODEL
I am building WareTrack, a warehouse management app. The attached image shows the target look and feel. First, design only the data layer. No UI yet. Use TypeScript. Define types for Site, Dock, Truck, Forklift, InventoryItem and Shipment, with clear relations between them. Create realistic seed data: 3 sites, 6 docks per site, 12 trucks, 8 forklifts, 40 inventory items and 25 shipments with ETAs. Put it in src/data/. Then explain the model in five lines.

PROMPT 2: 3D SCENE
Using the existing data model and the attached concept image, build a 3D warehouse scene with React Three Fiber and drei. Render docks, trucks, forklifts and shelving as simple low-poly shapes, positioned from the data. Use a strategy-game camera: isometric angle, pan with mouse drag, zoom with the wheel, and limits so the user cannot leave the map. Add soft shadows and a clean grid floor. Do not change the data files.

PROMPT 3: CLICK TO INSPECT
Make every object clickable. On click, highlight the object with an outline and open a side panel showing its live status: name, state, current shipment, and the last update time. Simulate live updates every 2 seconds by changing truck and forklift states in a store. Use Zustand. The panel must update without reloading the scene. Keep the scene components free of business logic.

PROMPT 4: KPIs, SITES AND FILTERS
Add a top bar with a site selector. Switching the site moves the camera smoothly to that warehouse. Add a KPI panel: on-time delivery rate, docks in use, active trucks, and low-stock alerts, all computed from the data store. Add filters to show only delayed shipments, or only trucks of a chosen status. Use a dark industrial theme with amber accents.

PROMPT 5: REVIEW AND POLISH
Review the whole project like a senior engineer. 1. List bugs, performance problems and unused code. 2. Use instancing if there are many repeated meshes. 3. Make sure the app runs smoothly at 60 FPS. 4. Fix what you find, then run the build and the type check, and show me the results. Do not add new features.

WHEN SOMETHING GOES WRONG
Paste the exact error message. Say what you expected to happen. Change one thing at a time. Ask for the cause, then the fix. Commit after every working step.
```

## 상황
- 빈 저장소(최초 커밋만 있음), Orca 워크트리의 작업 브랜치(원본 폴더의 main과 분리)에서 시작
- 전역 CLAUDE.md에 완료 게이트·범위 규율·git 규칙·정직한 보고가 이미 들어 있음

## 의도
- 남이 만든 5단계 프롬프트(창고 관리 앱)를 **로드맵**으로 통째로 주되, **이번에 할 범위는 "공장처럼 움직이는 애니메이션"으로 좁힌다**
- 데이터 연결은 "나중"이라고 못 박아, 애니메이션 단계에서 데이터 설계가 막히지 않게 한다

## Claude Code가 한 일
1. `git status`·`git branch`로 작업 위치를 확인하고, 빈 저장소임을 확인
2. `npm view`로 라이브러리 최신 버전과 호환 범위(peerDependencies)를 조회
3. 창고 앱 템플릿을 공장으로 옮겨 설계: 자재창고 → AGV → 생산라인 2개(CNC·용접 로봇·비전 검사·포장) → 출하 도크
4. 데이터(타입·레이아웃) → 시뮬레이터(순수 TypeScript) → 3D 장면 → UI 순서로 구현. **로직과 렌더링을 분리**하는 구조를 스스로 제안
5. Vitest 테스트를 먼저 작성해 시뮬레이터 불변식(수량 보존·간격·AGV 안전거리·재현성)을 확인
6. 2시간 분량 시뮬레이션 통계를 뽑아 이상치를 스스로 찾음 → AGV-04만 배터리 0%·운반 23회 → 정류장 도착 판정 버그 수정 + 회귀 테스트
7. Playwright로 실제 브라우저를 띄워 캡처·콘솔 확인 → drei `Html`의 React 19 오류 발견 → DOM 오버레이 라벨로 교체
8. 같은 방법으로 라인 투입 자재 부족(군집 주행), 출하 도크가 패널에 가리는 문제를 찾아 수정
9. 완료 게이트(타입 체크 0 에러 → 빌드 성공)를 확인하고 보고. 커밋은 하지 않음(요청 전)

## 사람이 정한 것
| AI의 질문 또는 제안 | 사람의 결정 |
|---|---|
| (질문 없이 진행) 원래 1~3단계를 공장에 맞게 합쳐 구현 | 결과 확인 후 다음 지시(02, 03번) |

## 검증
- 테스트 6개 통과(정류장 버그 회귀 테스트 포함), 타입 체크 0 에러, 빌드 성공
- 2시간 통계: 병목은 용접 로봇(가동률 96~98%), AGV-04 이상치 발견·수정
- 브라우저: 60 FPS, 클릭 선택·상세 패널 동작

## 결과
- 커밋: 이 단계 단독 커밋 없음(03번 결과와 함께 4a6e234)
- 산출물: 3D 공장 애니메이션, 시뮬레이터, 클릭 상세 패널, 테스트

## 방법론 포인트
- **마스터 프롬프트 = 전체 로드맵 + 이번 범위.** 전체를 먼저 보여 줘야 이후 "4단계 진행하자" 한마디로 이어 갈 수 있다
- **템플릿은 번역해서 쓴다.** 창고·트럭·사이트를 공장·AGV·구역으로 바꾸는 일을 AI에게 맡기되 결과는 사람이 확인한다
- **Verify를 넣으면 AI가 스스로 잰다.** 테스트 통과에서 멈추지 않고 통계·브라우저로 버그를 찾았다

## 교육용으로 다듬은 프롬프트
```text
Context: 스마트 팩토리 디지털 트윈을 만든다. 아래 5단계 프롬프트(창고 관리 앱 예시)를 전체 로드맵으로 참고하되, 우리 도메인(제조 공장)에 맞게 바꿔서 적용한다.
Goal: 이번에는 실제 공장처럼 움직이는 3D 애니메이션까지만 만든다. 데이터 연동은 다음 단계로 미룬다.
Constraints: React + TypeScript + React Three Fiber. 시뮬레이션 로직은 화면 코드와 분리한다. 요청하지 않은 기능은 넣지 않는다.
Output: 실행 방법, 폴더 구조, 바꾼 파일 목록.
Verify: 시뮬레이션을 2시간 분량 돌려 이상치를 찾고, 테스트·타입 체크·빌드 결과와 브라우저 화면을 확인한 뒤 보고한다.

[참고: 전체 5단계 프롬프트 원문]
```

## 메모 (추가·변경용)
- 
