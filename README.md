# 😉 역앞 (Yeok-Ap)

서울 지하철 이용객을 위한 실시간 정보 & 커뮤니티 앱입니다.  
혼잡도·열차 위치·경로 탐색을 한 화면에서 확인하고, 이웃 승객들과 제보를 나눕니다.

---

## 주요 기능

### 🏠 홈
| 기능 | 설명 |
|------|------|
| 실시간 혼잡도 | ActionCable(WebSocket)으로 노선별 혼잡도 실시간 수신 (여유/보통/혼잡/폭발) |
| 저장된 경로 | 즐겨찾기 경로 카드 — 출퇴근 시간대 자동 하이라이트, 탭 시 즉시 검색 |
| 즐겨찾기 역 | 저장 역 혼잡도 현황 카드 |
| 최근 본 역 | 최근 조회 역 빠른 접근 |
| 내 주변 역 | GPS 기반 반경 5km 내 가장 가까운 역 표시 |
| 노선 팔로우 | 관심 노선만 필터링해서 보기 |

### 🗺️ 노선도
| 기능 | 설명 |
|------|------|
| 노선 지도 오버레이 | Google Maps 위에 역 순서대로 혼잡도 표시 (`GOOGLE_MAPS_API_KEY` 설정 시) |
| 혼잡도 시트 폴백 | API 키 없을 때 자동으로 혼잡도 목록 시트로 대체 |

### 🚇 열차 위치
| 기능 | 설명 |
|------|------|
| 실시간 열차 위치 | 서울 Open API 기반, 20초 자동 갱신 |
| 지원 노선 | 1–9호선 · 수인분당선 · 경의중앙선 · 공항철도 · 신분당선 |
| 카운트다운 | 다음역 도착까지 남은 시간 초 단위 표시 |
| 당겨서 새로고침 | 기존 카운트다운 유지한 채 백그라운드 갱신 (`Math.min` 병합) |

### 🔍 길찾기
| 기능 | 설명 |
|------|------|
| 역 자동완성 | 역명 그룹화 — 한 행에 역 이름 + 모든 노선 배지 |
| 최근 경로 기록 | 입력창 포커스 시 최근 검색 5개 드롭다운, 탭하면 바로 검색 |
| 경로 탐색 | 최단/환승최소 모드, 9호선 급행 실시간 반영 |
| 혼잡도 경보 | 경유 역 혼잡 시 배너 표시 |
| 즐겨찾기 저장 | 결과 카드 북마크 → 출근·퇴근·자주가는곳 라벨 지정 |
| 출발 알림 | 결과 카드 알림 버튼 → 10/20/30분 전 로컬 푸시 알림 |

### 💬 커뮤니티
| 기능 | 설명 |
|------|------|
| 제보 피드 | 호선·역·방면·사진 포함 제보 작성 |
| 실시간 인기 글 | Hot / 댓글 많은순 / 호선별 정렬 |
| 좋아요 | 낙관적 업데이트, 실패 시 롤백 |
| 댓글 | 게시글 상세에서 댓글 작성 |

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
| 로컬 저장 | AsyncStorage (피드 캐싱, 즐겨찾기, 최근 경로) |
| 이미지 | expo-image, expo-image-picker |

---

## 성능 최적화

- **커뮤니티 피드 캐싱**: stale-while-revalidate — 캐시 즉시 표시 후 백그라운드 갱신
- **좋아요 낙관적 업데이트**: 서버 응답 전 즉시 UI 반영, 실패 시 롤백
- **AppState 감지**: 백그라운드 복귀 시 모달 자동 닫힘 + 피드 재갱신 (터치 불능 방지)
- **열차 카운트다운 보존**: 새로고침 시 `Math.min(로컬, API)` 병합으로 카운트 초기화 방지

---

## 환경 변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `EXPO_PUBLIC_API_HOST` | 백엔드 REST API 베이스 URL | 로컬 개발 서버 자동 감지 |
| `EXPO_PUBLIC_WS_URL` | ActionCable WebSocket URL | 로컬 개발 서버 자동 감지 |
| `GOOGLE_MAPS_API_KEY` | Google Maps API 키 (Android 노선도) | 없으면 혼잡도 목록 시트로 폴백 |

> `GOOGLE_MAPS_API_KEY`는 빌드 시 GitHub Secret으로 주입됩니다 (`app.config.js`).

---

## 실행

```bash
npm install

# 로컬 백엔드 연결
npx expo start

# 프로덕션 백엔드 연결 (Render)
EXPO_PUBLIC_API_HOST=https://yeok-ap-backend.onrender.com \
EXPO_PUBLIC_WS_URL=wss://yeok-ap-backend.onrender.com/cable \
npx expo start --tunnel
```

---

## 빌드 (Android APK)

GitHub Actions에서 **수동으로** 빌드합니다.

```
Actions 탭 → Build Android APK → Run workflow
```

빌드 흐름:
```
expo prebuild → Gradle assembleRelease (debug keystore 서명) → GitHub Artifacts (90일 보관)
```

> **`GOOGLE_MAPS_API_KEY` Secret** 등록 시 노선도 지도 기능 포함 빌드  
> EAS Cloud 한도 없이 무제한 로컬 Gradle 빌드

---

## 화면 구조

```
app/
├── (tabs)/
│   ├── index.tsx        # 홈 — 혼잡도, 저장된 경로, 즐겨찾기 역, 최근 본 역
│   ├── search.tsx       # 길찾기 — 역 자동완성, 경로 탐색, 즐겨찾기/알림
│   ├── community.tsx    # 커뮤니티 피드, 인기 글, 제보 작성 모달
│   └── settings.tsx     # 설정 / 프로필
├── best-posts.tsx       # 실시간 인기 글 전체보기 (Hot/댓글순/호선별)
└── report/[id].tsx      # 게시글 상세 (좋아요, 댓글)

app/components/
├── TrainLocationSheet.tsx   # 열차 위치 바텀 시트 (20초 자동 갱신)
├── LineMapModal.tsx          # 노선도 지도 (Google Maps + 혼잡도 오버레이)
└── LineCongestionSheet.tsx   # 혼잡도 목록 시트 (지도 폴백)

utils/
├── favorites.ts          # 즐겨찾기 역 저장/조회
├── favoriteRoutes.ts     # 즐겨찾기 경로 + 최근 검색 기록 (AsyncStorage)
└── notifications.ts      # 출발 알림 스케줄링 (expo-notifications)
```

---

© 2026 Yeok-Ap · v1.0.4
