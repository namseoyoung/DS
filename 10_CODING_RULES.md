# 인생여(ㄱ)전 Coding Rules

## 1. 기본 원칙

이 프로젝트는 행사에서 실제 운영되는 투자 시뮬레이션 플랫폼이다.

코드는 다음 기준을 우선한다.

1. 안정성
2. 가독성
3. 유지보수성
4. 실시간 데이터 일관성
5. 모바일 사용성

---

## 2. 절대 규칙

### 2-1. 투자 데이터는 프론트엔드에서만 관리하지 않는다

금지:

- localStorage로 투자금 저장
- useState만으로 투자금 관리
- 프론트에서만 현금 차감
- 프론트에서만 정산 계산

반드시 서버 API와 DB를 통해 처리한다.

---

### 2-2. 서버에서 반드시 검증한다

투자 요청 시 서버에서 확인할 것:

- 로그인한 사용자 여부
- 현재 게임 상태가 INVESTING 또는 REALTIME_ROUND인지
- 게임이 PAUSED 상태가 아닌지
- 투자 금액이 0보다 큰지
- 보유 현금보다 투자 금액이 크지 않은지
- 해당 기업이 존재하는지

---

### 2-3. 관리자 권한은 서버에서도 검증한다

프론트에서 관리자 버튼을 숨기는 것만으로 끝내지 않는다.

다음 API는 반드시 `role=admin` 검증이 필요하다.

- 연봉 지급
- 투자 시작
- 투자 마감
- 정산
- 다음 연차
- 게임 일시정지
- 게임 재개
- 뉴스 발송
- 공지 발송
- 기업 정보 수정
- 회원 정보 수정
- 리셋

---

## 3. 프론트엔드 구조

추천 폴더 구조:

```text
src/
  api/
    authApi.ts
    userApi.ts
    companyApi.ts
    investmentApi.ts
    gameApi.ts
    newsApi.ts
    rankingApi.ts

  components/
    common/
      Button.tsx
      Card.tsx
      Modal.tsx
      Toast.tsx
      Badge.tsx

    participant/
      AssetSummaryCard.tsx
      MarketChart.tsx
      HoldingCard.tsx
      CompanyCard.tsx
      InvestmentModal.tsx

    admin/
      AdminStatusBar.tsx
      AdminControlPanel.tsx
      MemberTable.tsx
      CompanyTable.tsx
      RankingPanel.tsx
      TransactionLog.tsx
      NewsForm.tsx
      AnnouncementPanel.tsx

    display/
      DisplayHeader.tsx
      DisplayRanking.tsx
      DisplayCountdown.tsx
      DisplayEnding.tsx

  pages/
    LoginPage.tsx
    ParticipantPage.tsx
    AdminPage.tsx
    DisplayPage.tsx

  hooks/
    useAuth.ts
    useGameStatus.ts
    useRealtime.ts
    useTimer.ts

  utils/
    formatCurrency.ts
    formatPercent.ts
    calculateAsset.ts

  types/
    user.ts
    company.ts
    investment.ts
    game.ts
```

현재 MVP는 단일 `src/types.ts`, `src/lib/api.ts` 구조를 사용한다. 기능이 커질 때 위 구조로 점진적으로 분리한다.

## 4. 백엔드 구조

백엔드는 다음 책임을 분리한다.

- API 라우팅
- 권한 검증
- 게임 상태 변경
- 투자/정산/연봉 계산
- DB 저장
- 실시간 브로드캐스트

투자, 정산, 연봉 지급, 랭킹 계산은 서버에서 처리한다.

## 5. 실시간 규칙

- 투자 성공 후 전체 상태를 다시 브로드캐스트한다.
- 관리자 상태 변경 후 전체 상태를 다시 브로드캐스트한다.
- 전광판은 조작 기능 없이 서버 상태만 표시한다.
- 참가자 화면은 본인 데이터만 중심으로 표시한다.

## 6. UI 코드 규칙

- 참가자 화면은 모바일 퍼스트로 작성한다.
- 카드, 버튼, 그래프, 폰트 규칙은 [10_UI_DESIGN_PHILOSOPHY.md](./10_UI_DESIGN_PHILOSOPHY.md)를 따른다.
- 버튼 이름은 사용자가 바로 이해할 수 있는 한국어를 사용한다.
- 관리자 화면은 한눈에 상태를 파악할 수 있도록 정보 밀도를 유지한다.

## 7. 문서 규칙

새 기능을 구현하기 전 다음 문서를 확인한다.

- PRD
- DB Schema
- User Flow
- UI Guide
- Deploy Guide
- Project Constitution
- Coding Rules

문서와 구현이 다르면 문서를 기준으로 수정한다.
