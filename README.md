# 역앞 (Yeok-Ap) — 프론트엔드

서울 지하철 이용객을 위한 실시간 정보 & 커뮤니티 앱입니다.  
혼잡도·열차 위치·경로 탐색을 한 화면에서 확인하고, 이웃 승객들과 제보를 나눕니다.  
앱 시작 시 애니메이션 스플래시 화면이 표시됩니다 (정적 스플래시 제거).

---

## 주요 기능

### 홈
| 기능 | 설명 |
|------|------|
| 실시간 혼잡도 | ActionCable(WebSocket)으로 노선별 혼잡도 실시간 수신. HTTP 폴백 최대 12회 재시도 |
| 운행 종료 감지 | 노선별 실제 막차 후 자동으로 "운행 종료" 표시 (시간 하드코딩 없음) |
| 저장된 경로 | 즐겨찾기 경로 카드 — 출퇴근 시간대 자동 하이라이트, 탭 시 즉시 검색 |
| 즐겨찾기 역 | 저장 역 혼잡도 현황 카드 (운행종료 시 뱃지 숨김) |
| 내 주변 역 | GPS 기반 반경 5km 내 가장 가까운 역 표시 |
| 노선 팔로우 | 관심 노선만 필터링 |

### 길찾기
| 기능 | 설명 |
|------|------|
| 역 자동완성 | 초성 검색 포함, 역 이름 + 모든 노선 배지 그룹화 |
| 최근 경로 기록 | 입력창 포커스 시 최근 검색 5개, 탭하면 바로 검색 |
| 경로 탐색 | 최단/환승최소 모드, 9호선 급행 실시간 반영 |
| 도착 예상 시간 | 실시간 열차 도착 API로 "N분 후 출발 → HH:MM 도착 예상" 표시 (시간표 폴백) |
| 혼잡도 경보 | 경유 역 혼잡 시 배너 표시 |
| 즐겨찾기 저장 | 결과 카드 북마크 → 출근·퇴근·자주가는곳 라벨 |
| 출발 알림 | 10/20/30분 전 로컬 푸시 알림 |

### 열차 위치
| 기능 | 설명 |
|------|------|
| 실시간 열차 위치 | 서울 Open API 기반, 20초 자동 갱신 |
| 지원 노선 | 1–9호선 · 수인분당선 · 경의중앙선 · 공항철도 · 신분당선 외 |
| 카운트다운 | 다음역 도착까지 초 단위 카운트다운 |

### 역 상세 / 혼잡도 시트
| 기능 | 설명 |
|------|------|
| 실시간 도착 정보 | 해당 역·노선 기준 도착 열차 목록 (환승역 노선 필터) |
| 혼잡도 타임라인 | 시간대별 혼잡도 이력 차트 |
| 노선도 | 노선 전 역 혼잡도 한 번에 보기 |

### 커뮤니티
| 기능 | 설명 |
|------|------|
| 제보 피드 | 혼잡도·역·방면·사진 포함 제보 작성 |
| 혼잡도 직접 선택 | 여유/보통/혼잡/폭발 4단계 칩 선택 (필수) |
| 역 자동완성 | 역 이름 입력 시 자동완성 → 탭하면 역+호선 동시 설정 |
| 방면 자동 제안 | 선택 역 기준 인접역(앞뒤 다음역) 2개를 칩으로 제시 |
| 실시간 인기 글 | Hot / 댓글 많은순 / 호선별 정렬 |
| 좋아요 | 낙관적 업데이트, 실패 시 롤백 |
| 댓글 | 게시글 상세에서 작성 |
| 기기 연동 | 로그아웃해도 내 글 유지 (device_token 보존) |

### 설정
| 기능 | 설명 |
|------|------|
| 알림 설정 | 출발 알림 / 혼잡도 경보 / 댓글 알림 / 공지 알림 토글 |
| 공지사항 / FAQ | 앱 내 공지 및 자주 묻는 질문 |

---

## 기술 스택

| 구분 | 내용 |
|------|------|
| Framework | Expo SDK 54 (React Native) |
| Language | TypeScript |
| Navigation | Expo Router v3 (파일 기반) |
| Real-time | @rails/actioncable (WebSocket) |
| 지도 | react-native-maps (Google Maps) |
| 알림 | expo-notifications (로컬 푸시) |
| 로컬 저장 | AsyncStorage (즐겨찾기, 최근 경로, 알림 설정) |
| 이미지 | expo-image, expo-image-picker |

---

## 환경 변수

| 변수 | 설명 |
|------|------|
| `EXPO_PUBLIC_API_HOST` | 백엔드 REST API 베이스 URL |
| `EXPO_PUBLIC_WS_URL` | ActionCable WebSocket URL (`wss://...`) |
| `GOOGLE_MAPS_API_KEY` | Google Maps API 키 (없으면 혼잡도 목록 시트로 폴백) |

> `GOOGLE_MAPS_API_KEY`는 빌드 시 GitHub Secret으로 주입됩니다 (`app.config.js`).

---

## 실행

```bash
npm install

# 로컬 백엔드
npx expo start

# 프로덕션 백엔드 연결
EXPO_PUBLIC_API_HOST=https://yeok-ap-backend.onrender.com \
EXPO_PUBLIC_WS_URL=wss://yeok-ap-backend.onrender.com/cable \
npx expo start --tunnel
```

---

## 빌드 (Android APK)

GitHub Actions에서 수동으로 빌드합니다.

```
Actions 탭 → Build Android APK → Run workflow
```

```
expo prebuild → Gradle assembleRelease → GitHub Artifacts (90일 보관)
```

---

## 화면 구조

```
app/
├── (tabs)/
│   ├── index.tsx          # 홈 — 혼잡도, 저장된 경로, 즐겨찾기, 주변역
│   ├── search.tsx         # 길찾기 — 자동완성, 경로 탐색, 도착 예상, 즐겨찾기/알림
│   ├── community.tsx      # 커뮤니티 피드, 인기 글, 제보 작성
│   └── settings.tsx       # 설정
├── best-posts.tsx          # 실시간 인기 글 (Hot/댓글순/호선별)
├── notification-settings.tsx
├── notices.tsx
├── faqs.tsx
└── report/[id].tsx         # 게시글 상세

app/components/
├── TrainLocationSheet.tsx  # 열차 위치 바텀 시트
├── LineMapModal.tsx        # 노선도 (Google Maps + 혼잡도)
├── LineCongestionSheet.tsx # 역 혼잡도 시트 (실시간 도착 포함)
└── StationDetailModal.tsx  # 역 상세 모달

contexts/
└── SubwayDataContext.tsx   # WebSocket + HTTP 폴백 혼잡도 상태 관리

utils/
├── favorites.ts            # 즐겨찾기 역
├── favoriteRoutes.ts       # 즐겨찾기 경로 + 최근 검색
└── notifications.ts        # 출발 알림 스케줄링
```

---

© 2026 Yeok-Ap · v1.2.0
