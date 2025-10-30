import { getDb } from '@/services/database';
import { COLORS, mainStyle } from '@/styles';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';

type TrackPoint = { ts:number; lat:number; lng:number };
type EventRow = { ts:number; type:string; value:number; lat:number; lng:number };

export default function Summary() {
  const { sessionId, distanceM, score } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [track, setTrack] = useState<TrackPoint[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventContexts, setEventContexts] = useState<string | null[]>([])
  const [loadingContext, setLoadingContext] = useState(true)

  const mapRef = useRef<MapView>(null);
  const listRef = useRef<FlatList<EventRow>>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [reverseGeo, setReverseGeo] = useState<string | null>(null);
  const selectedEvent = selectedId != null ? events[selectedId] : null;
  const selectedContext = selectedId != null ? eventContexts[selectedId] : null;
  
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!mapReady || !track.length || !mapRef.current) return;
    const coords = track.map(p => ({ latitude: p.lat, longitude: p.lng }));
    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 80, right: 40, bottom: 300, left: 40 },
      animated: true,
    });
    console.log("Fitted")
  }, [mapReady, track]);

  useEffect(() => {
  (async () => {
    if (!sessionId) return;

    const db = await getDb();
    const sid = Array.isArray(sessionId) ? sessionId[0] : sessionId;
    const t: TrackPoint[] = await db.getAllAsync(
      'SELECT ts, lat, lng FROM track WHERE session_id = ? ORDER BY ts ASC',
      [sid]
    );
    const ev: EventRow[] = await db.getAllAsync(
      'SELECT ts, type, value, lat, lng FROM events WHERE session_id = ? ORDER BY ts ASC',
      [sid]
    );

    setTrack(t);
    setEvents(ev);
    setLoading(false);
    console.log("Getting")
    fetchFirstEventContext(ev);
    setEventContexts(Array(ev.length).fill(null)); 
    ev.forEach((item, i) => {
      getContextAt(item.ts, item.type, item.lat, item.lng).then((ctx) => {
        setEventContexts(prev => {
          const next = [...prev];
          next[i] = typeof ctx === 'string' ? ctx : null;
          return next;
        });
      });
    });
    
    if (t.length && mapRef.current) {
      const coords = t.map(p => ({ latitude: p.lat, longitude: p.lng }));
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(coords, {
          edgePadding: { top: 80, right: 40, bottom: 300, left: 40 },
          animated: true,
        });
      }, 100);
    }
  })();
}, [sessionId]);

async function fetchFirstEventContext(evLocal: EventRow[]) {
  if (!evLocal.length) return;
  const first = evLocal[0];
  await Promise.all([
    getWeatherAt(first.lat, first.lng, first.ts),
    getRoadAt(first.lat, first.lng),
  ]);
}

  async function getWeatherAt(lat: number, lng: number, ts: number) {
    try {
      const res = await fetch('http://192.168.1.73:8080/get-weather', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, when_utc: new Date(ts).toISOString() }),
      });
      const text = await res.text(); 
      if (!res.ok) {
        console.warn('get-weather failed', res.status, text);
        return;
      }
      console.log('weather:', text);
    } catch (e) {
      console.warn('network error calling get-weather:', e);
    }
  }

  async function getRoadAt(lat: number, lng: number) {
    try {
      const res = await fetch('http://192.168.1.73:8080/get-road', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng }),
      });
      const text = await res.text(); 
      if (!res.ok) {
        console.warn('get-road failed', res.status, text);
        return;
      }
      console.log('road:', text);
    } catch (e) {
      console.warn('network error calling get-road:', e);
    }
  }
  async function getContextAt( ts: number, type: string, lat: number, lng: number) {
  try {
    const res = await fetch("http://192.168.1.73:8080/get-context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ts: new Date(ts).toISOString(),
        type,
        lat,
        lng,
      }),
    });

    const text = await res.text();
    if (!res.ok) {
      console.warn("get-context failed", res.status, text);
      return;
    }

    console.log("context:", text);
    return text;
  } catch (e) {
    console.warn("network error calling get-context:", e);
  }
}

  const polyCoords = useMemo(() => {
    const coords = track.map(p => ({ latitude: p.lat, longitude: p.lng }));
    if (coords.length < 2) return coords;
    const step = 5;
    const out: typeof coords = [];
    const hav = (a:any,b:any)=>{
      const R=6371000, dLat=(b.latitude-a.latitude)*Math.PI/180, dLng=(b.longitude-a.longitude)*Math.PI/180;
      const la1=a.latitude*Math.PI/180, la2=b.latitude*Math.PI/180;
      const s=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)**2;
      return 2*R*Math.asin(Math.sqrt(s));
    };
    for (let i=1;i<coords.length;i++){
      const a=coords[i-1], b=coords[i];
      out.push(a);
      const d = hav(a,b);
      const n = Math.floor(d/step);
      for (let k=1;k<=n;k++){
        const t = k/(n+1);
        out.push({
          latitude: a.latitude + (b.latitude - a.latitude)*t,
          longitude: a.longitude + (b.longitude - a.longitude)*t,
        });
      }
    }
    out.push(coords[coords.length-1]);
    return out;
  }, [track]);

  const flyTo = (lat:number, lng:number) => {
    mapRef.current?.animateCamera(
      { center: { latitude: lat, longitude: lng }, zoom: 17, pitch: 0, heading: 0 },
      { duration: 400 }
    );
  };

  const selectEvent = async (index:number, openDetails:boolean = false) => {
    setSelectedId(index);
    
    const e = events[index];
    flyTo(e.lat, e.lng);
    setReverseGeo(null);
    try { 
      const rg = await Location.reverseGeocodeAsync({ latitude: e.lat, longitude: e.lng });
      if (rg?.length) {
        const r = rg[0];
        setReverseGeo([r.name, r.street, r.city].filter(Boolean).join(', ') || null);
      }
    } catch {}
    if (openDetails) setDetailsOpen(true);
    listRef.current?.scrollToIndex({ index, animated: true });
  };

  const onMarkerPress = (index:number) => selectEvent(index, true);

  const pretty = (t:string) =>
    t === 'hard_brake' ? 'Hard Brake' :
    t === 'rapid_accel' ? 'Rapid Accel' :
    t === 'hard_corner' ? 'Hard Turn' :
    t === 'overspeed' ? 'Speeding' : t;


  const renderEvent = ({ item, index }: { item: EventRow, index:number }) => {
    const selected = index === selectedId;
    return (
      <Pressable
        onPress={() => selectEvent(index, true)}
        style={{
          paddingVertical: 10,
          paddingHorizontal: 12,
          backgroundColor: selected ? '#FFF3EA' : '#FFFFFF', 
          borderBottomWidth: 1, borderColor: '#F0E7E2',
        }}
      >
        <Text style={{ fontWeight: '700', color: COLORS.text }}>
          {new Date(item.ts).toLocaleTimeString()} — {pretty(item.type)}
        </Text>
        <Text style={{ color: COLORS.subtext }}>
          {/* Value: {Number.isFinite(item.value) ? item.value.toFixed(2) : String(item.value)} */}
        </Text>
      </Pressable>
    );
  };

  if (loading) {
    return (
      <View style={{ flex:1, justifyContent:'center', alignItems:'center', backgroundColor: COLORS.bg }}>
        <ActivityIndicator color={COLORS.brand} />
      </View>
    );
  }

  const distanceMiles = distanceM
    ? parseFloat(Array.isArray(distanceM) ? distanceM[0] : distanceM)
    : 0;

  return (
    <View style={{flex: 1, backgroundColor: COLORS.bg}}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={{ flex: 1,  }}
        initialRegion={{
          latitude: polyCoords[0]?.latitude ?? 37.7749,
          longitude: polyCoords[0]?.longitude ?? -122.4194,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        onMapReady={() => setMapReady(true)}

      >
        {polyCoords.length > 1 && (
          <Polyline
            coordinates={polyCoords}
            strokeWidth={5}
            strokeColor={COLORS.brand}       
          />
        )}

        {events.map((e, i) => (
          <Marker
            key={`${e.ts}-${i}`}
            coordinate={{ latitude: e.lat, longitude: e.lng }}
            onPress={() => onMarkerPress(i)}
            pinColor={i === selectedId ? COLORS.danger : COLORS.brand}
          />
        ))}
      </MapView>

      <View style={mainStyle.sheet}>
        <View style={{ paddingBottom: 6 }}>
          <Text style={[mainStyle.title, { textAlign:'center' }]}>Trip Summary</Text>
          <View style={styles.chipRow}>
            <View style={styles.chip}>
              <Text style={styles.chipText}>Distance: {distanceMiles.toFixed(2)} mi</Text>
            </View>
            <View style={styles.chip}>
              <Text style={styles.chipText}>Score: {Number(score).toFixed(1)}/100</Text>
            </View>
            <View style={styles.chip}>
              <Text style={styles.chipText}>Events: {events.length}</Text>
            </View>
            
          </View>
          <Text style={{ textAlign:'center', color: COLORS.subtext, marginTop: 6 }}>
            Tap an event to view details
          </Text>
        </View>

        <View style={{ flex: 1, marginTop: 8 }}>
          <FlatList
            ref={listRef}
            data={events}
            keyExtractor={(_, i) => i.toString()}
            renderItem={renderEvent}
            initialNumToRender={12}
            showsVerticalScrollIndicator
            getItemLayout={(_, index) => ({ length: 56, offset: 56 * index, index })}
            contentContainerStyle={{ paddingBottom: 12 }}
          />
        </View>

        <View style={{ flexDirection:'row', justifyContent:'flex-end', gap: 10, marginTop: 8, marginBottom: 10, marginRight: 4 }}>
          <Pressable style={styles.btnOutline} onPress={() => router.replace('/home')}>
            <Text style={styles.btnOutlineText}>Home</Text>
          </Pressable>
          <Pressable style={styles.btnPrimary} onPress={() => router.replace('/drivingSession')}>
            <Text style={styles.btnPrimaryText}>New Drive</Text>
          </Pressable>
        </View>
      </View>

      <Modal
        visible={detailsOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setDetailsOpen(false)}
      >
        <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.25)', justifyContent:'flex-end' }}>
          <View style={{ backgroundColor:'#fff', padding:16, borderTopLeftRadius:16, borderTopRightRadius:16 }}>
            {selectedEvent ? (
              <>
                <Text style={{ fontSize:18, fontWeight:'800', marginBottom:6, color: COLORS.text }}>
                  {pretty(selectedEvent.type)}
                </Text>
                <Text style={{ color:COLORS.text }}>Time: {new Date(selectedEvent.ts).toLocaleString()}</Text>
                {/* <Text style={{ color:COLORS.text }}>
                  Value: {Number.isFinite(selectedEvent.value) ? selectedEvent.value.toFixed(2) : String(selectedEvent.value)}
                </Text> */}
                {reverseGeo && <Text style={{ color:COLORS.subtext, marginTop:6 }}>Near: {reverseGeo}</Text>}

                <View style={{ marginTop: 12, padding: 12, backgroundColor:'#FAFAFA', borderRadius:8, borderWidth:1, borderColor:'#F0F0F0' }}>
                  <Text style={{ fontWeight:'700', marginBottom:4, color: COLORS.text }}>AI Analysis</Text>
                  {!selectedContext?.length ? <View style={{ flex:1, justifyContent:'center', alignItems:'center', backgroundColor: COLORS.bg }}>
        <ActivityIndicator color={COLORS.brand} />
      </View>:  <Text style={{ color: COLORS.subtext }}>
                    {selectedContext?.substring(1, selectedContext.length - 1)}
                  </Text>}
                </View>

                <View style={{ alignItems:'flex-end', marginTop:12 }}>
                  <Pressable onPress={() => setDetailsOpen(false)} style={styles.btnOutline}>
                    <Text style={styles.btnOutlineText}>Close</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <Text style={{ color: COLORS.subtext }}>No event selected</Text>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}


const styles = StyleSheet.create({
   chipRow: { 
    flexDirection: 'row',
     justifyContent: 'center',
      gap: 8, 
      marginTop: 6,
  },
  chip: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: COLORS.border, 
    paddingVertical: 6, 
    paddingHorizontal: 10, 
    borderRadius: 999, 
  }, 
  chipText: { color: COLORS.subtext,
    fontWeight: '600', 
  }, 
  btnOutline: { 
    backgroundColor: '#FFF', 
    borderWidth: 1, 
    borderColor: COLORS.border, 
    paddingVertical: 10, 
    paddingHorizontal: 16, 
    borderRadius: 12, 
    minWidth: 110, 
    alignItems: 'center', 
  }, 
  btnOutlineText: { 
    color: COLORS.text, 
    fontWeight: '700',
    fontSize: 16, 
  }, 
  btnPrimary: { 
    backgroundColor: COLORS.brand, 
    paddingVertical: 10, 
    paddingHorizontal: 18, 
    borderRadius: 12, 
    minWidth: 110, 
    alignItems: 'center', 
  }, 
  btnPrimaryText: { 
    color: '#fff', 
    fontWeight: '800',
    fontSize: 16,
  }, 
})