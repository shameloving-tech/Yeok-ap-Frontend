import React, { createContext, useContext } from 'react';
import { useSubwayData } from '@/hooks/useSubwayData';

type SubwayDataContextType = {
  stationList: any[];
  reports: any[];
  isConnected: boolean;
};

const SubwayDataContext = createContext<SubwayDataContextType>({
  stationList: [],
  reports: [],
  isConnected: false,
});

export function SubwayDataProvider({ children }: { children: React.ReactNode }) {
  const data = useSubwayData();
  return (
    <SubwayDataContext.Provider value={data}>
      {children}
    </SubwayDataContext.Provider>
  );
}

export function useSubwayDataContext() {
  return useContext(SubwayDataContext);
}
