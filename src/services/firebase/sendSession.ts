// services/firebase/sendSession.ts
import { addDoc, collection } from 'firebase/firestore';
import { db } from './initFirebase';

type EventCounts = {
  hard_brake?: { count: number; coords: { lat: number; lng: number }[] };
  rapid_accel?: { count: number; coords: { lat: number; lng: number }[] };
  hard_corner?: { count: number; coords: { lat: number; lng: number }[] };
  overspeed?: { count: number; coords: { lat: number; lng: number }[] };
  [k: string]: { count: number; coords: { lat: number; lng: number }[] } | undefined;
};

type BBox = { minLat: number; maxLat: number; minLng: number; maxLng: number };

type LatLng = {
    lat: number;
    lng: number
}

export async function publishSessionSummary({
  ownerId,
  startedAt,
  durationSec,
  distanceMi,
  score,
  eventCounts,
  polyline,        
  bbox,            
  visibility = 'friends',
}: {
  ownerId: string | undefined;
  startedAt: Date;
  durationSec: number;
  distanceMi: number;
  score: number;
  eventCounts: EventCounts;
  polyline?: LatLng[] | null;
  bbox?: BBox | null;
  visibility?: 'private' | 'friends' | 'public';
}) {
  if (!ownerId) throw new Error('No ownerId (user not signed in)');
  const ref = await addDoc(collection(db, "sessions"), {
    ownerId,
    startedAt,
    durationSec,
    distanceMi,
    score,
    eventCounts,
    polyline: polyline || null,
    bbox: bbox || null,
    visibility,
  });
    console.log("Document written with ID: ", ref.id);

}
export async function sendEvents({lat, lng}: {lat: number, lng: number}) {
  const ref = await addDoc(collection(db, "events"), {
    lat,
    lng,
    
  });
    console.log("Document written with ID: ", ref.id);

}
