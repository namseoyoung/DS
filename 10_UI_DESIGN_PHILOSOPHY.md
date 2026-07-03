# UI Design Philosophy

이 프로젝트는 "행사용 투자 플랫폼"이지만, 참가자가 실제 투자 앱을 사용하는 느낌을 받아야 한다.

## 디자인 컨셉

- Toss Securities 70%
- Apple Stocks 20%
- Game UI 10%

## 핵심 키워드

- 미니멀
- 직관적
- 여백이 많은 디자인
- 큰 숫자
- 카드 중심
- 모바일 퍼스트
- 금융 앱 느낌

## 절대 사용하지 말 것

- 화려한 게임 UI
- 네온 색상
- 과한 애니메이션
- 복잡한 버튼
- 많은 텍스트

## 판단 기준

참가자가 3초 안에 현재 자산과 투자 상태를 이해할 수 있어야 한다.

새 화면이나 컴포넌트를 만들 때는 다음 질문을 먼저 확인한다.

- 현재 자산이 가장 먼저 보이는가?
- 투자 가능 상태를 즉시 알 수 있는가?
- 그래프와 숫자가 텍스트 설명보다 먼저 이해되는가?
- 버튼 이름이 설명 없이 이해되는가?
- 게임처럼 보이기보다 금융 앱처럼 신뢰감 있게 보이는가?

## Component Tokens

### Card

- `border-radius`: 20px
- `padding`: 24px
- `shadow`: light
- `background`: white

### Button

- `border-radius`: 14px
- `height`: 52px
- `primary`: blue
- `secondary`: white

### Graph

- Library: Recharts
- Line: smooth line
- Animation: enabled
- Tooltip: enabled
- Legend: hidden

### Font

- Family: Pretendard
- Numbers: Bold
- Text: Medium
