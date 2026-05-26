# 😉 역앞 (Yeok-Ap)

지하철 이용객들이 실시간 혼잡도를 확인하고 정보를 공유하는 커뮤니티 앱입니다.

## 주요 기능

- **실시간 혼잡도**: ActionCable(WebSocket)으로 노선별 혼잡도 실시간 수신 (여유/보통/혼잡/폭발)
- **경로 탐색**: 출발역 → 도착역 최적 경로 안내, 9호선 급행 운행 여부 실시간 표시
- **즐겨찾기 노선**: 관심 노선만 필터링해서 보기
- **커뮤니티 제보**: 호선·역·방면·사진 포함 제보 작성, 상태 뼛지(여유/보통/혼잡/폭발) 표시
- **실시간 인기 글**: Hot/댓글 많은순/호선별 정렬, 전체보기 화면 제공
- **게시글 상세**: 좋아요 토글 (낙관적 업데이트), 댓글 작성
- **역 검색**: 역 이름으로 검색 → 최근 및 역 저장
- **현재 위치 기반 가장 가까운 역** 표시
- **프로필 편집**: 닉네임·프로필 사진 설정

## 기술 스택

| 구분 | 내용 |
|------|------|
| Framework | Expo SDK 54 (React Native) |
| Language | TypeScript |
| Navigation | Expo Router v3 (파일 기반) |
| Real-time | @rails/actioncable (WebSocket) |
| 로컴 저장 | AsyncStorage (피드 캐싱, 좋아요 상태 포함) |
| 이미지 | expo-image, expo-image-picker |

## 성능 최적화

- **커뮤니티 피드 캐싱**: stale-while-revalidate — 캐시 즉시 표시 후 백그라운드 갱신
- **좋아요 낙관적 업데이트**: 서버 응답 전 즉시 UI 반영, 실패 시 롤백
- **AppState 감지**: 백그라운드 복귀 시 모달 자동 닫힌 + 피드 재갱신 (터치 불능 방지)

## 환경 변수

| 변수 | 설명 |
|------|------|
| `EXPO_PUBLIC_API_HOST` | 백엔드 REST API 베이스 URL |
| `EXPO_PUBLIC_WS_URL` | ActionCable WebSocket URL |

설정하지 않으면 개발 환경에서 로컈 서버(`http://<devHost>:3000`)에 자동 연결됩니다.

## 실행

```bash
npm install

# 로컈 백엔드 연결
npx expo start

# 프로덕션 백엔드 연결 (Render)
EXPO_PUBLIC_API_HOST=https://yeok-ap-backend.onrender.com \
EXPO_PUBLIC_WS_URL=wss://yeok-ap-backend.onrender.com/cable \
npx expo start --tunnel
```

## 빌드 (Android APK)

`main` 브랜치 푸시 시 GitHub Actions에서 자동 빌드됩니다.

```
expo prebuild → Gradle assembleDebug → GitHub Artifacts
```

Actions 탭 → 완료된 워크플로우 → **Artifacts**에서 APK 다운로드

> EAS Cloud 한도 없이 무제한 빌드 가능

## 화면 구조

```
app/
├── (tabs)/
│   ├── index.tsx        # 홈 — 실시간 혼잡도 목록, 즐겨찾기 필터, 최근 본 역
│   ├── route.tsx        # 경로 탐색 — 출발/도착 입력, 급행 표시, 환승 안내
│   ├── community.tsx    # 커뮤니티 피드, 실시간 인기 글, 제보 작성 모달
│   ├── search.tsx       # 역 검색
│   └── settings.tsx     # 설정 / 프로필
├── best-posts.tsx       # 실시간 인기 글 전체보기 (Hot/댓글순/호선별)
├── report/[id].tsx      # 게시글 상세 (좋아요, 댓글)
└── modal.tsx            # 프로필 편집 (닉네임, 사진)
```

---
© 2026 Yeok-Ap · v1.0.4
