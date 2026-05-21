# 🚉 역앞 (Yeok-Ap)

지하철 이용객들이 실시간 혼잡도를 확인하고 정보를 공유하는 커뮤니티 앱입니다.

## 주요 기능

- **실시간 혼잡도**: ActionCable(WebSocket)으로 노선별 혼잡도 실시간 수신 (여유/보통/혼잡/폭발)
- **즐겨찾기 노선**: 관심 노선만 필터링해서 보기
- **커뮤니티 제보**: 호선·역·방면 선택 후 사진 포함 제보 작성
- **게시글 상세**: 좋아요 토글, 댓글 작성
- **역 검색**: 역 이름으로 검색 → 최근 본 역 저장
- **현재 위치 기반 가장 가까운 역** 표시

## 기술 스택

| 구분 | 내용 |
|------|------|
| Framework | Expo SDK 54 (React Native) |
| Language | TypeScript |
| Navigation | Expo Router (파일 기반) |
| Real-time | @rails/actioncable (WebSocket) |
| 로컬 저장 | AsyncStorage |
| 이미지 | expo-image, expo-image-picker |

## 환경 변수

| 변수 | 설명 |
|------|------|
| `EXPO_PUBLIC_API_HOST` | 백엔드 REST API 베이스 URL |
| `EXPO_PUBLIC_WS_URL` | ActionCable WebSocket URL |

설정하지 않으면 개발 환경에서 로컬 서버(`http://<devHost>:3000`)에 자동 연결됩니다.

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

## 화면 구조

```
app/
├── (tabs)/
│   ├── index.tsx        # 홈 — 실시간 혼잡도 목록, 즐겨찾기 필터, 최근 본 역
│   ├── community.tsx    # 커뮤니티 피드, 제보 작성 모달
│   ├── search.tsx       # 역 검색
│   └── settings.tsx     # 설정 / 프로필
├── report/[id].tsx      # 게시글 상세 (좋아요, 댓글)
└── modal.tsx            # 닉네임 변경
```

---
© 2026 Yeok-Ap
