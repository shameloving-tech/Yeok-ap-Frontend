import { createConsumer } from '@rails/actioncable';
import { useEffect, useRef, useState } from 'react';
import { WS_URL } from '@/constants/config';

export const useSubwayData = () => {
  const [stationList, setStationList] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const subscriptionRef = useRef<any>(null);
  const consumerRef = useRef<any>(null);

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
