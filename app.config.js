// app.config.js — app.json 기반에 환경변수로 Google Maps API 키를 주입합니다.
// GitHub Secret 'GOOGLE_MAPS_API_KEY' 를 설정하면 지도 오버레이가 활성화됩니다.
// 키가 없는 경우 자동으로 수평 노선도(LineCongestionSheet)로 폴백됩니다.
const appJson = require('./app.json');

module.exports = {
  ...appJson.expo,
  android: {
    ...appJson.expo.android,
    config: {
      googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_API_KEY ?? '',
      },
    },
  },
};
