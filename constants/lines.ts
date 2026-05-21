export const LINE_CONFIG = [
  { id: '1호선', name: '1호선', color: '#0052A4' },
  { id: '2호선', name: '2호선', color: '#00A84D' },
  { id: '3호선', name: '3호선', color: '#EF7C1C' },
  { id: '4호선', name: '4호선', color: '#00A4E3' },
  { id: '5호선', name: '5호선', color: '#996CAC' },
  { id: '6호선', name: '6호선', color: '#CD7C2F' },
  { id: '7호선', name: '7호선', color: '#747F00' },
  { id: '8호선', name: '8호선', color: '#E6186C' },
  { id: '9호선', name: '9호선', color: '#BDB092' },
  { id: '수인분당선', name: '수인분당선', color: '#FFB100' },
  { id: '경의중앙선', name: '경의중앙선', color: '#77C4A3' },
  { id: '공항철도', name: '공항철도', color: '#0090D2' },
  { id: '신분당선', name: '신분당선', color: '#D4003B' },
  { id: '경춘선', name: '경춘선', color: '#0C8E72' },
  { id: '우이신설선', name: '우이신설선', color: '#B0CE18' },
  { id: '신림선', name: '신림선', color: '#6789CA' },
  { id: '김포골드라인', name: '김포골드라인', color: '#AD8605' },
  { id: '경강선', name: '경강선', color: '#003DA5' },
  { id: '서해선', name: '서해선', color: '#81A914' },
  { id: '인천1호선', name: '인천1호선', color: '#7CA8D5' },
  { id: '인천2호선', name: '인천2호선', color: '#ED8B00' },
  { id: 'GTX-A', name: 'GTX-A', color: '#9A6262' },
];

export const getLineColor = (lineName: string): string => {
  if (!lineName) return '#AEAEB2';
  const found = LINE_CONFIG.find(l => lineName.includes(l.name));
  return found ? found.color : '#AEAEB2';
};

export const getLineNumber = (lineName: string): string => {
  if (!lineName) return 'M';
  const match = lineName.match(/(\d+)/);
  return match ? match[1] : 'M';
};
