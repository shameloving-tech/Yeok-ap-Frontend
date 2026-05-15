# 🚉 역앞 (Yeok-Ap) - 내 손안의 지하철 정보 커뮤니티

**역앞(Yeok-Ap)**은 지하철 이용객들이 실시간 정보를 공유하고, 복잡한 역사 내 정보를 한눈에 확인할 수 있도록 돕는 서비스입니다.

## 📱 서비스 소개
"지하철 역 앞에서 만나는 실시간 정보와 우리들의 이야기"
단순한 시간표 조회를 넘어, 현재 지하철의 혼잡도, 돌발 상황 등을 사용자들끼리 실시간으로 공유하고 소통할 수 있는 플랫폼을 지향합니다.

## ✨ 주요 기능
- **실시간 혼잡도 리포트**: 사용자들이 직접 보고하는 실시간 칸별 혼잡도 확인
- **스마트 시간표**: 현재 위치 기반 가장 가까운 지하철역 정보 및 실시간 도착 예정 시간
- **지하철 커뮤니티**: 특정 역이나 노선별로 소통할 수 있는 자유 게시판
- **개인화 설정**: 자주 가는 역 즐겨찾기 및 맞춤형 알림 서비스

## 🛠 기술 스택
- **Framework**: React Native (Expo)
- **Language**: TypeScript
- **State Management**: React Hooks & Context API
- **Real-time**: ActionCable (Websocket) integration
- **Styling**: Nativewind / Styled-components (Vanilla CSS 기반)
- **Navigation**: Expo Router (File-based Routing)

## 🚀 시작하기

### 환경 설정
1. 프로젝트를 클론합니다.
2. 의존성 패키지를 설치합니다.
   ```bash
   npm install
   ```

### 실행 방법
1. 개발 서버를 구동합니다.
   ```bash
   npx expo start
   ```
2. Expo Go 앱을 통해 QR 코드를 스캔하거나, iOS/Android 에뮬레이터를 사용하여 앱을 확인합니다.

## 🎨 디자인 가이드
- **Main Color**: Subway Green (#2D6A4F)
- **Typography**: Pretendard / System Default
- **Assets**: 커스텀 제작된 지하철 캐릭터 애니메이션 스플래시 화면 적용

---
© 2026 Yeok-Ap Team. All rights reserved.
