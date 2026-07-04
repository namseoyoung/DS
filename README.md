# 인생여(ㄱ)전

실시간 투자 시뮬레이션 웹 플랫폼

## 프로젝트 소개

인생여(ㄱ)전은 기업 경영과 투자 경험을 게임 형태로 체험하는 모바일 기반 투자 시뮬레이션 플랫폼입니다.

참가자는 회사의 직원이 되어 연봉을 받고 기업에 투자하며 최종적으로 가장 높은 자산을 만드는 것이 목표입니다.

행사는 총 세 가지 화면으로 운영됩니다.

- 참가자 화면
- 관리자 화면
- 전광판

## 기술스택

Frontend:

- React
- TypeScript
- TailwindCSS
- Recharts

Backend:

- Node.js
- Express

Database:

- Supabase PostgreSQL

Realtime:

- Socket.IO

Deployment:

- Vercel
- Render
- Supabase

## 주요 기능

- 로그인
- 투자
- 기업 관리
- 관리자 운영
- 전광판
- 뉴스
- 공지
- 실시간 그래프
- 자동 정산
- 랭킹

## 문서

- 프로젝트 개요: [01_PROJECT_OVERVIEW.md](./01_PROJECT_OVERVIEW.md)
- 개발 단계: [TASK.md](./TASK.md)
- 사용자 흐름: [04-1_USER_FLOW.md](./04-1_USER_FLOW.md)
- UI 기준: [04_UI_GUIDE.md](./04_UI_GUIDE.md)
- UI 디자인 철학: [10_UI_DESIGN_PHILOSOPHY.md](./10_UI_DESIGN_PHILOSOPHY.md)
- DB 설계: [02_DB_SCHEMA.md](./02_DB_SCHEMA.md)
- 배포 가이드: [08_DEPLOY.md](./08_DEPLOY.md)
- 개발 헌장: [09_PROJECT_CONSTITUTION.md](./09_PROJECT_CONSTITUTION.md)
- 코딩 규칙: [10_CODING_RULES.md](./10_CODING_RULES.md)
- 테스트 케이스: [11_TEST_CASE.md](./11_TEST_CASE.md)
- MVP 체크리스트: [12_MVP_CHECKLIST.md](./12_MVP_CHECKLIST.md)
- Supabase SQL: [supabase/schema.sql](./supabase/schema.sql)

## 구현 현황

완료된 MVP 범위:

1. 프로젝트 구조 생성
2. DB 스키마 설계
3. 로그인 기능
4. 참가자 페이지
5. 투자 기능
6. 관리자 페이지
7. 운영 대시보드
8. 거래 로그
9. 4년차 실시간 그래프
10. 전광판 모드
11. 최종 엔딩 화면

`investments`는 사용자/기업/연차별 누적 투자 상태를 저장하고, `transactions`는 모든 투자/연봉/정산 액션 로그를 저장합니다.

## 로컬 실행

```bash
npm install
copy .env.example .env
npm run dev:all
```

브라우저에서 접속합니다.

- 참가자: `http://localhost:5173/participant`
- 관리자: `http://localhost:5173/admin`
- 전광판: `http://localhost:5173/display`
- API 상태: `http://localhost:4000/health`

Supabase 환경변수가 없으면 Express 서버는 로컬 메모리 저장소로 실행됩니다. 실제 행사/배포에서는 반드시 Supabase 환경변수를 설정해야 모든 기기가 같은 데이터를 공유합니다.

## 데모 계정

- 관리자: `admin` / `admin-2026`
- 참가자: `p001` ~ `p030` / `1111`

40명까지 늘릴 때는 Supabase `users` 테이블에 `p031`부터 같은 형식으로 추가하면 됩니다.

## Supabase 설정

1. Supabase 프로젝트를 생성합니다.
2. SQL Editor에서 [supabase/schema.sql](./supabase/schema.sql)을 실행합니다.
3. 백엔드 환경변수에 다음 값을 설정합니다.

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CLIENT_ORIGIN=https://your-vercel-domain.vercel.app
```

`SUPABASE_SERVICE_ROLE_KEY`는 Express 서버에서만 사용하고 프론트엔드에는 노출하지 않습니다.

## 운영 순서

1. 관리자가 `/admin`에서 로그인합니다.
2. `연봉 지급`을 눌러 현재 연차 연봉을 지급합니다.
3. 투자 시간을 설정하고 `투자 시작`을 누릅니다.
4. 참가자는 `/participant`에서 기업에 금액 단위로 투자합니다.
5. 관리자는 `투자 마감` 후 기업별 변동률을 입력하고 `정산 확정`을 누릅니다.
6. 1~3년차는 `다음 연차`로 반복합니다.
7. 4년차는 `4년차 실시간 라운드`와 `4년차 가치 갱신`으로 그래프를 갱신합니다.
   - 4년차 기업 가치는 최근 10초 동안의 투자/회수 흐름만 반영하며, 1회 갱신 변동폭은 제한됩니다.
8. `게임 종료`를 누르면 `/display`에 최종 엔딩이 표시됩니다.

## 배포

자세한 배포 및 행사 당일 체크리스트는 [08_DEPLOY.md](./08_DEPLOY.md)를 확인합니다.

### Vercel

- Build Command: `npm run build`
- Output Directory: `dist`
- Environment Variable: `VITE_API_URL=https://your-api.onrender.com`
- [vercel.json](./vercel.json)에 SPA fallback rewrite가 포함되어 있습니다.

### Render

- Start Command: `npm run start:server`
- Environment Variables:
  - `PORT`
  - `CLIENT_ORIGIN`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

## 다음에 해야 할 일

- Supabase 프로젝트에서 [supabase/schema.sql](./supabase/schema.sql)을 실행해 실제 DB를 준비합니다.
- 실제 참가자 30~40명 계정을 `users` 테이블에 생성합니다.
- 관리자 페이지의 prompt 기반 회원/기업 수정 UI를 전용 모달 또는 인라인 편집으로 개선합니다.
- 4년차 최종 정산에 순위별 변동 규칙 `+50%, +25%, 0%, -25%, -50%`를 더 엄격히 반영합니다.
- 배포 URL에서 모바일 다중 접속 리허설을 진행합니다.
