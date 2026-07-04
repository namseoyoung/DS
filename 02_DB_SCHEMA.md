# 인생여전 DB Schema

## 1. 설계 원칙

이 프로젝트는 행사 현장에서 30~40명이 동시에 접속하는 투자 시뮬레이션 플랫폼이다. 투자/정산 데이터는 `localStorage`나 클라이언트 상태가 아니라 Supabase PostgreSQL에 저장한다.

MVP 구현에서는 참가자 계정과 회사 식별자가 운영자가 알아보기 쉬운 `text` 값이다.

- 사용자 예: `p001`, `p002`, `admin`
- 기업 예: `sanghyun`, `seoyoung`, `ain`, `donghyun`, `yeil`

`transactions`는 모든 행동 로그를 저장하고, `investments`는 사용자/기업/연차별 누적 투자 상태를 저장한다.

## 2. 핵심 테이블

### `game_status`

현재 게임 진행 상태를 저장한다.

- `year`, `status`: 서버가 사용하는 현재 연차와 상태
- `timer_ends_at`, `paused_remaining_seconds`: 카운트다운 및 일시정지용
- `current_year`, `current_phase`, `remaining_seconds`, `is_paused`: PRD 명칭과 운영 대시보드 확장을 위한 호환 필드

### `companies`

5개 기업의 현재 가치와 순위 계산용 값을 저장한다.

- `initial_capital`
- `current_value`
- `previous_value`
- `change_rate`
- `total_investment`
- `company_rank`

초기 기업:

- 상현회사: 5000
- 서영회사: 5000
- 아인회사: 5000
- 동현회사: 5000
- 예일회사: 4500

### `users`

참가자와 관리자를 저장한다.

- `id`, `username`, `password`
- `nickname`, `real_name`
- `company_id`, `rank`
- `cash`
- `invested_amount`, `evaluated_amount`, `total_asset`, `profit_rate`
- `is_online`
- `role`: `participant` 또는 `admin`

### `investments`

사용자/기업/연차별 누적 투자 상태다.

- `user_id`
- `company_id`
- `year`
- `invested_amount`
- `evaluated_amount`
- `profit_rate`

`unique (user_id, company_id, year)` 제약으로 같은 연차의 같은 기업 투자는 하나의 행에 누적된다.

### `transactions`

모든 운영/투자 행동 로그다.

- `user_id`, `user_name`
- `company_id`, `company_name`
- `amount`
- `action_type`: 예 `INVEST`, `SALARY`, `SETTLEMENT`
- `year`
- `memo`
- `created_at`

### `company_value_history`

4년차 실시간 그래프와 정산 기록에 사용한다.

- `company_id`
- `tick`
- `year`
- `value`
- `change_rate`
- `recorded_at`

### `news`

관리자가 발송한 뉴스다.

- `title`
- `content`
- `company_id`
- `year`
- `is_published`

### `announcements`

관리자가 발송한 공지다.

- `title`
- `content`
- `target`

### `connection_status`

실시간 접속 상태 확장용 테이블이다.

- `user_id`
- `is_online`
- `last_seen_at`
- `socket_id`

### `salary_rules`

연봉 지급 로직 확장용 테이블이다.

- `company_type`: `default`, `yale`
- `rank`
- `salary`

### `final_results`

최종 엔딩 결과 저장용 테이블이다.

- `winning_company_id`
- `winning_user_id`
- `company_score`
- `user_total_asset`

## 3. 초기화 방법

Supabase SQL Editor에서 [supabase/schema.sql](supabase/schema.sql)을 실행한다.

이 스키마는 다음 초기 데이터를 포함한다.

- 게임 상태 1개
- 5개 기업
- 관리자 계정 1개
- 테스트 참가자 계정 30개
- 연봉 규칙 10개

40명까지 테스트 계정을 늘릴 때는 `users` 테이블에 `p031`부터 같은 방식으로 추가하면 된다.
