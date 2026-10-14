---
id: 07
title: 체크포인트 — "커밋하고 main에 올려 줘" (1)
phase: 5 체크포인트 커밋
commit: 34dfdb0
---

# 07. 체크포인트 — "커밋하고 main에 올려 줘" (1)

## 원문
> 커밋하고 main에 올려 줘

## 상황
- 06번 결과를 확인함. 이후 사람이 `! git -C <원본 폴더> pull origin main`으로 로컬 main을 맞춤

## 의도
- 동작하는 단계마다 체크포인트를 남긴다(마스터 프롬프트의 "Commit after every working step")

## Claude Code가 한 일
1. `git fetch`로 원격 main이 바뀌지 않았는지 확인(fast-forward 가능 여부)
2. 스테이징 후 diff 통계·시크릿 grep 확인
3. 변경 내용을 항목별로 정리한 커밋 메시지 작성 → 커밋 → `git push origin HEAD:main`
4. 원격 main 해시 확인

## 사람이 정한 것
| AI의 질문 또는 제안 | 사람의 결정 |
|---|---|
| 로컬 main 동기화 명령 안내 | 사람이 직접 pull |

## 검증
- 원격 main = 34dfdb0

## 결과
- 커밋: 34dfdb0 (28개 파일, +1042 −196)

## 방법론 포인트
- **커밋 시점은 사람이 정한다.** AI가 매 변경마다 자동 커밋하지 않게 규칙으로 막고, 사람이 결과를 본 뒤 "커밋해"라고 말한다
- 같은 문장을 반복해도 AI는 매번 원격 상태부터 다시 확인한다

## 교육용으로 다듬은 프롬프트
```text
Goal: 방금 확인한 변경을 커밋하고 원격 main에 올린다.
Constraints: 원격이 앞서 있으면 멈추고 알린다. 커밋 전 diff 검토.
Verify: 원격 main 해시를 보여 준다.
```

## 메모 (추가·변경용)
- 
