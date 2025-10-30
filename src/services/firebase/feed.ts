import { collection, getDocs, limit, orderBy, query, Timestamp, where } from 'firebase/firestore';
import { db } from './initFirebase';

type LatLng = {
    lat: number;
    lng: number;
}

export type FeedItem = {
  id: string;
  ownerId: string;
  startedAt: Timestamp | Date;
  durationSec: number;
  distanceMi: number;
  score?: number;
  eventCounts?: Record<string, number>;
  polyline?: LatLng[] | null;
  bbox?: { minLat:number; minLng:number; maxLat:number; maxLng:number } | null;
  visibility?: 'private'|'friends'|'public';
};

export async function fetchFeed(friendIds: string[], pageLimit = 25) {

  const chunks: string[][] = [];
  for (let i = 0; i < friendIds.length; i += 10) chunks.push(friendIds.slice(i, i + 10));

  const results: any[] = [];
  for (const group of chunks) {
    const q = query(
      collection(db, 'sessions'),
      where('ownerId', 'in', group),
      orderBy('startedAt', 'desc'),
      limit(pageLimit)
    );
    const snap = await getDocs(q);
    snap.forEach(d => results.push({ id: d.id, ...d.data() }));
  }

  results.sort((a, b) => (b.startedAt?.toMillis?.() ?? 0) - (a.startedAt?.toMillis?.() ?? 0));
  return results.slice(0, pageLimit);
}