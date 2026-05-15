// hooks/useSubwayData.ts
import { createConsumer } from '@rails/actioncable';
import { useEffect, useRef, useState } from 'react';

const SERVER_URL = 'ws://192.168.45.88:3000/cable';

export const useSubwayData = () => {
  const [stationList, setStationList] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const subscriptionRef = useRef<any>(null);

  useEffect(() => {
    const consumer = createConsumer(SERVER_URL);
    subscriptionRef.current = consumer.subscriptions.create(
      { channel: "CongestionChannel" },
      {
        connected() { setIsConnected(true); },
        disconnected() { setIsConnected(false); },
        received(data: any) { setStationList(data); }
      }
    );

    return () => {
      subscriptionRef.current?.unsubscribe();
      consumer.disconnect();
    };
  }, []);

  return { stationList, isConnected };
};