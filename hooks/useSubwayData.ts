import { createConsumer } from '@rails/actioncable';
import { useEffect, useRef, useState } from 'react';
import { BASE_URL, WS_URL } from '@/constants/config';

export const useSubwayData = () => {
  const [stationList, setStationList] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const subscriptionRef = useRef<any>(null);
  const consumerRef = useRef<any>(null);

  // HTTP 폴백: WebSocket 연결 전에 최신 스냅샷을 즉시 로드
  useEffect(() => {
    fetch(`${BASE_URL}/api/v1/stations/congestion`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.stations?.length > 0) setStationList(data.stations);
        if (data?.reports?.length > 0) setReports(data.reports);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    consumerRef.current = createConsumer(WS_URL);
    subscriptionRef.current = consumerRef.current.subscriptions.create(
      { channel: 'CongestionChannel' },
      {
        connected() { setIsConnected(true); },
        disconnected() { setIsConnected(false); },
        received(data: any) {
          if (data?.stations?.length > 0) setStationList(data.stations);
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
