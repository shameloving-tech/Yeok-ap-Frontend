import { useEffect, useState } from 'react';
import { BASE_URL } from '@/constants/config';

export type Ad = {
  id: number;
  title: string;
  image_url: string | null;
  link_url: string | null;
  position: 'home_banner' | 'feed_between' | 'community_detail';
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
  status: string;
};

const cache: Record<string, { data: Ad[]; at: number }> = {};
const TTL = 5 * 60 * 1000; // 5분

export function useAds(position: Ad['position']) {
  const [ads, setAds] = useState<Ad[]>([]);

  useEffect(() => {
    const now = Date.now();
    if (cache[position] && now - cache[position].at < TTL) {
      setAds(cache[position].data);
      return;
    }
    fetch(`${BASE_URL}/admin/advertisements`)
      .then((r) => r.json())
      .then((data: Ad[]) => {
        const active = data.filter((a) => a.status === 'active' && a.position === position);
        cache[position] = { data: active, at: Date.now() };
        setAds(active);
      })
      .catch(() => {});
  }, [position]);

  const ad = ads[0] ?? null;
  return ad;
}
