# KMU-VD Time Analyzer

국민대학교 시각디자인학과 학생들의 과제 소요 시간을 측정하고, 평균 데이터를 시각화하는 단일 목적 웹앱 프로토타입입니다.

## Core Focus

- 수업명 / 교수명 검색 및 선택
- 실시간 과제 소요 시간 측정
- 측정 종료 시 기록 저장
- 주간 / 월간 평균 시간 분석
- 비교 기준: 수업명+교수명 / 수업명 / 교수명 / 전체 참여자

## Current Data Mode

- 기본값은 더미 데이터 + 브라우저 `localStorage`
- 저장소 인터페이스는 `src/data/repository.js`
- 백엔드 연결 분기점은 `src/data/service.js`

## Backend Hook

전역 변수 `window.__TIME_ANALYZER_API_BASE__`를 주입하면 API 모드로 전환할 수 있습니다.

예상 엔드포인트:

- `GET /catalog`
- `GET /records`
- `POST /records`

## File Map

- `index.html`: 앱 진입점
- `src/main.js`: 렌더링, 타이머 제어, 상태 관리
- `src/styles.css`: 오실로스코프 / 계기판 무드의 UI 스타일
- `src/data/mock.js`: 더미 수업 및 기록 데이터
- `src/data/repository.js`: 로컬 저장소 기반 저장소
- `src/data/service.js`: API 연결 가능 저장소 선택 레이어
- `src/lib/time.js`: 포맷팅 및 평균 계산 유틸리티
