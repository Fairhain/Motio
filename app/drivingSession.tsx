import { auth } from '@/services/firebase/initFirebase';
import { publishSessionSummary } from '@/services/firebase/sendSession';
import { appendEvents, appendSamples, appendTrack, detectEvents } from '@/services/logging';
import { COLORS, mainStyle } from '@/styles';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { DeviceMotion } from 'expo-sensors';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { v4 as uuidv4 } from 'uuid';


function dist(a: {lat:number,lng:number}, b:{lat:number,lng:number}) {
  const R = 6371000, dLat = (b.lat-a.lat)*Math.PI/180, dLng=(b.lng-a.lng)*Math.PI/180;
  const la1 = a.lat*Math.PI/180, la2=b.lat*Math.PI/180;
  const s = Math.sin(dLat/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(s));
}

type LatLng = {
  lat: number;
  lng: number;
}

export default function DrivingSession() {
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState<1|2|3>(2); // 1=paused, 2=recording, 3=error

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [locSub, setLocSub] = useState<Location.LocationSubscription | null>(null);
  const [speed, setSpeed] = useState<number | null>(null);
  const [samples, setSamples] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [acceleration, setAcceleration] = useState<{ x: number; y: number; z: number } | null>(null);

  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const [track, setTrack] = useState<Array<{ts:number; lat:number; lng:number}>>([]);
  const lastCoordRef = useRef<{lat:number; lng:number} | null>(null);
  const [distanceM, setDistanceM] = useState(0);
  
  const [popupText, setPopupText] = useState("")
  const [popupVisible, setPopupVisible] = useState(false)

  const mapRef = useRef<MapView>(null);



  useEffect(() => {

    DeviceMotion.setUpdateInterval(100);
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') console.warn('Location permission not granted');
    })();
    startSession();
    return () => {
      stopSensors();
    };
  }, []);



  function handleNewEvent(event: { type: string; lat: number; lng: number }) {
    setPopupText(getFriendlyText(event.type));
    setPopupVisible(true);

    setTimeout(() => setPopupVisible(false), 3000);
  }

  function getFriendlyText(type: string) {
    switch (type) {
      case "hard_brake": return "Hard Brake Detected!";
      case "rapid_accel": return "Rapid Acceleration!";
      case "hard_corner": return "Sharp Turn!";
      case "overspeed": return "Overspeed Warning!";
      default: return "Event Detected!";
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


  const startSensors = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    startTimeRef.current = Date.now() - elapsed * 1000;
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    const sub = DeviceMotion.addListener(({ acceleration, rotationRate, rotation }) => {
      if (!acceleration) return;
      const ts = Date.now();
      const sample = {
        ts,
        speed: speed ?? 0,
        ax: acceleration.x ?? 0,
        ay: acceleration.y ?? 0,
        az: acceleration.z ?? 0,
        rotationRateZ: rotationRate?.alpha ?? 0,
      };
      setAcceleration({ x: sample.ax, y: sample.ay, z: sample.az });
      setSamples(prev => [...prev, sample]);

      const evts = detectEvents(sample, {
        lateralMps2: 3.0,
        hardBrakeMps2: -6.0,
        rapidAccelMps2: 3.5,
        yawAlpha: 0.3,
        speedLimitMps: 27,
        overspeedTolerance: 0.1,
        
      }, {alpha: rotation.alpha,
        gamma: rotation.gamma,
        beta: rotation.beta});
      if (evts.length > 0) {
        const pos = lastCoordRef.current;
        const enriched = pos
          ? evts.map(e => ({ ...e, lat: pos.lat, lng: pos.lng }))
          : evts.map(e => ({ ...e, lat: 0, lng: 0 }));
        setEvents(prev => [...prev, ...enriched]);
        handleNewEvent(enriched[enriched.length - 1]);
      }
    });
    setSubscription(sub);

    const subLoc = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 100, distanceInterval: 1 },
      (loc) => {
        const { latitude, longitude, speed } = loc.coords;
        setSpeed(Number.isFinite(speed ?? NaN) ? (speed as number) : 0);
        const ts = Date.now();
        const now = { lat: latitude, lng: longitude };
        setTrack(prev => [...prev, { ts, ...now }]);

        const prev = lastCoordRef.current;
        if (prev) {
          const dMeters = dist(prev, now);
          if (dMeters > 0.5) setDistanceM(m => m + dMeters / 1609.344);
        }
        lastCoordRef.current = now;
        console.log(events)

      }
    );
    setLocSub(subLoc);
  };

  const stopSensors = () => {
    subscription?.remove?.();
    setSubscription(null);
    locSub?.remove?.();
    setLocSub(null);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const startSession = async () => {
    const id = uuidv4();
    setSessionId(id);
    setSamples([]);
    setEvents([]);
    setActive(true);
    setStatus(2);
    setElapsed(0);
    await startSensors();
  };

  const pauseSession = () => {
    if (!active || status === 1) return;
    stopSensors();
    setStatus(1);
  };

  const unPauseSession = async () => {
    if (!active || status === 2) return;
    await startSensors();
    setStatus(2);
  };

  const stopSession = async () => {
    stopSensors();
    setActive(false);
    setStatus(2);
    setElapsed(0);
    if (sessionId) {
      await appendSamples(sessionId, samples);
      await appendEvents(sessionId, events);
      await appendTrack(sessionId, track);

    const ownerId = auth.currentUser?.uid;
    const startedAt = new Date(startTimeRef.current);
    const durationSec = elapsed;
    const distanceMi = distanceM;
    
    const eventsPerMinute = events.length / (durationSec / 60);

    const score = (Math.max(Math.min(1, 1 - eventsPerMinute), 0) * 100);

    const eventCounts = events.reduce((acc: Record<string, { count: number; coords: { lat: number; lng: number }[] }>, e: any) => {
      if (!acc[e.type]) {
        acc[e.type] = { count: 0, coords: [] };
      }
      acc[e.type].count += 1;
      if (e.lat && e.lng) {
        acc[e.type].coords.push({ lat: e.lat, lng: e.lng });
      }
      return acc;
    }, {});

    const lats = track.map(p => p.lat);
    const lngs = track.map(p => p.lng);
    const bbox = {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLng: Math.min(...lngs),
      maxLng: Math.max(...lngs),
    };
    const polyline = track.map(p => ({ lat: p.lat, lng: p.lng })); 

    try {
      await publishSessionSummary({
        ownerId,
        startedAt,
        durationSec,
        distanceMi,
        score,
        eventCounts,
        polyline: polyline,
        bbox,
        visibility: 'public',
      });
    } catch (err) {
      console.warn('Failed to publish summary:', err);
    }

      router.navigate({ pathname: '/summary', params: { sessionId, distanceM: String(distanceM), score } });
    }
  };

  const exit = async () => {
    stopSensors();
    setActive(false);
    setStatus(1);
    router.navigate('/home');
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <View style={{flex: 1, backgroundColor: COLORS.bg}}>
      <MapView
        ref={mapRef}
        style={styles.map}
        showsUserLocation
        followsUserLocation
        initialRegion={{
          latitude: 34.5,
          longitude: -118.4194,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        zoomEnabled={false}
        rotateEnabled={false}
        scrollEnabled={false}
      >
        {events.map((e, i) => (
          <Marker
            key={i}
            coordinate={{ latitude: e.lat, longitude: e.lng }} 
            pinColor={COLORS.brand}
          />
        ))}
        {polyCoords.length > 1 && (
          <Polyline
            coordinates={polyCoords}
            strokeWidth={5}
            strokeColor={COLORS.brand}       
          />
        )}
      </MapView>

      <View style={mainStyle.sheet}>
        <View style={styles.statusRow}>
          {status === 1 && <Text style={[styles.badge, { backgroundColor: COLORS.paused, color: '#fff' }]}>Paused</Text>}
          {status === 2 && <Text style={[styles.badge, { backgroundColor: COLORS.brand, color: '#fff' }]}>Active</Text>}
          {status === 3 && <Text style={[styles.badge, { backgroundColor: COLORS.danger, color: '#fff' }]}>Error</Text>}
        </View>

        <Text style={styles.timerText}>{formatTime(elapsed)}</Text>

        <Text style={styles.statText}>Total Distance: {distanceM.toFixed(2)} mi</Text>
        <Text style={styles.statText}>Speed: {status === 2 && speed != null ? `${(speed * 2.23694).toFixed(2)} mph` : '0'}</Text>
        <Text style={styles.statText}>
          Acceleration: {status === 2 && acceleration
            ? `x: ${(acceleration.x*2.23694).toFixed(2)}, y: ${(acceleration.y*2.23694).toFixed(2)}, z: ${(acceleration.z*2.23694).toFixed(2)}`
            : 'x: 0, y: 0, z: 0'}
        </Text>

        <View style={styles.actions}>
          <Pressable
            style={styles.pauseButton}
            onPress={status === 2 ? pauseSession : unPauseSession}
          >
            <Text style={{
              color: COLORS.brandDark,
              fontWeight: '700',
              fontSize: 16,
            }}>
              {status === 1 ? 'Resume' : 'Pause'}
            </Text>
          </Pressable>

          <Pressable style={styles.exitButton} onPress={exit}>
            <Text style={{
              color: COLORS.text,
              fontWeight: '700',
              fontSize: 16,
            }}>Exit</Text>
          </Pressable>

          <Pressable style={styles.endButton} onPress={stopSession}>
            <Text style={{
              color: '#fff',
            fontWeight: '800',
            fontSize: 16,
            }}>End</Text>
          </Pressable>
        </View>
      </View>

      <Modal
  transparent
  visible={popupVisible}
  animationType="fade"
  onRequestClose={() => setPopupVisible(false)}
>
  <View
    style={{
      flex: 1,
      paddingTop: 70,
      alignItems: "center",
    }}
  >
    <View
      style={{
        backgroundColor: "#FFF",
        padding: 10,
        borderRadius: 12,
        alignItems: "center",
        shadowColor: "#000",
        shadowOpacity: 0.2,
        shadowRadius: 6,
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: "700", color: COLORS.danger }}>
        {popupText}
      </Text>
    </View>
  </View>
</Modal>
    </View>
  );
}



const styles = StyleSheet.create({
  
  map: {
    flex: 1,
    maxHeight: 600


  },
  
  statusRow: {
    alignItems: 'center',
    marginBottom: 8,
  },
  badge: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    fontWeight: '700',
    overflow: 'hidden',
  },
  timerText: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    color: COLORS.text,
    marginBottom: 8,
  },
  statText: {
    marginVertical: 10,
    fontSize: 18,
    color: COLORS.subtext,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 30,
  },
  pauseButton: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: COLORS.brand,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    minWidth: 110,
    alignItems: 'center',
  },

  exitButton: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    minWidth: 110,
    alignItems: 'center',
  },

  endButton: {
    backgroundColor: COLORS.danger,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
    minWidth: 110,
    alignItems: 'center',
  },

});