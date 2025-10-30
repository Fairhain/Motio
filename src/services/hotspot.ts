import { db } from "@/services/firebase/initFirebase";
import { collection, getDocs, query } from "firebase/firestore";
import * as geofire from "geofire-common";

export async function fetchEventsInView(
  bbox: { minLat:number; minLng:number; maxLat:number; maxLng:number },
) {
  const center = [(bbox.minLat+bbox.maxLat)/2, (bbox.minLng+bbox.maxLng)/2] as [number,number];
  const radiusM = estimateViewportRadiusMeters(bbox); 
  const ranges = geofire.geohashQueryBounds(center, radiusM);

    const q = query(
        collection(db, "events"),
    );

  const snap = await getDocs(q);
  const rows = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));
  const filtered = rows.filter(r =>
    r.lat >= bbox.minLat && r.lat <= bbox.maxLat &&
    r.lng >= bbox.minLng && r.lng <= bbox.maxLng
  );
  
  return filtered as Array<{ lat:number; lng:number;}>;
}

function estimateViewportRadiusMeters(b: {minLat:number;minLng:number;maxLat:number;maxLng:number}) {
  const latC = (b.minLat+b.maxLat)/2;
  const dLatM = (b.maxLat - b.minLat) * 111_320;
  const dLngM = (b.maxLng - b.minLng) * 111_320 * Math.cos(latC*Math.PI/180);
  return Math.sqrt((dLatM/2)**2 + (dLngM/2)**2);
}

export function detectClusters(events : Array<{ lat:number; lng:number;}>) {
    const ret = []
    console.log(events)
    
    for (let i = 0; i < events.length-1; i++) {
        let count = 0
        let minLat = events[i].lat
        let minLng = events[i].lng
        let maxLat = events[i].lat
        let maxLng = events[i].lng

        
        for (let j = i+1; j < events.length; j++ ) {
            if (Math.abs(events[i].lat - events[j].lat) <= 0.01 && Math.abs(events[i].lng-events[j].lng) <= 0.01) {
                minLat = Math.min(minLat, events[j].lat)
                minLng = Math.min(minLng, events[j].lng)
                maxLat = Math.max(maxLat, events[j].lat)
                maxLng = Math.max(maxLng, events[j].lng)
                count++;
            }
        }

        if (count > 1) {ret.push({lat: (maxLat + minLat)/2, lng: (maxLng + minLng)/2}) }
    }
    return ret
}