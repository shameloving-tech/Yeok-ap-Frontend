import { createConsumer } from '@rails/actioncable';
import { useEffect, useRef, useState } from 'react';
import { BASE_URL, WS_URL } from '@/constants/config';

export const useSubwayData = () => {
  const [stationList, setStationList] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const subscriptionRef = useRef<any>(null);
  const consumerRef = useRef<any>(null);
  const hasLiveData = useRef(false);

  // HTTP 폴백: 데이터가 올 때까지 최대 12번 (10초 간격, 2분) 재시도
  useEffect(() => {
    let attempts = 0;
    const MAX_ATTEMPTS = 12;
    let timerId: ReturnType<typeof setTimeout>;

    const tryFetch = () => {
      if (hasLiveData.current) return; // WebSocket이 이미 데이터 받았으면 중단
      fetch(`${BASE_URL}/api/v1/stations/congestion`)
        .then((r) => r.json())
        .then((data) => {
          if (data?.stations?.length > 0 && !hasLiveData.current) {
            setStationList(data.stations);
            if (data.reports?.length > 0) setReports(data.reports);
          }
        })
        .catch(() => {})
        .finally(() => {
          attempts += 1;
          if (attempts < MAX_ATTEMPTS && !hasLiveData.current) {
            timerId = setTimeout(tryFetch, 10_000);
          }
        });
    };

    tryFetch();
    return () => clearTimeout(timerId);
  }, []);

  useEffect(() => {
    consumerRef.current = createConsumer(WS_URL);
    subscriptionRef.current = consumerRef.current.subscriptions.create(
      { channel: 'CongestionChannel' },
      {
        connected() { setIsConnected(true); },
        disconnected() { setIsConnected(false); },
        received(data: any) {
          if (data?.stations?.length > 0) {
            hasLiveData.current = true; // HTTP 폴링 중단 신호
            setStationList(data.stations);
          }
          if (data?.reports) setReports(data.reports);
        }
      }
    );

    return () => {
      subscriptionRef.current?.unsubscribe();
      consumerRef.current?.disconnect();
    };
  }, []);

  return { stationList, reports, isConnected };
};
