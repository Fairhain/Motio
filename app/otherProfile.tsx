import { db } from '@/services/firebase/initFirebase';
import { COLORS, mainStyle } from '@/styles';
import { router, useLocalSearchParams } from 'expo-router';
import { getAuth } from 'firebase/auth';
import { collection, doc, getDoc, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { default as React, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { LineGraph } from 'react-native-graph';


type Session = {
  id: string;
  ownerId: string;
  startedAt: any;       
  durationSec?: number;
  distanceMi?: number;
  score?: number;
  eventCounts?: Record<string, number>;
};


export default function OtherProfile() {

    const { uid } = useLocalSearchParams<{ uid: string }>();
    
  const auth = useMemo(() => getAuth(), []);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);


  const [displayName, setDisplayName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);



  useEffect(() => {
     const loadUser = async () => {
      try {
        const docRef = doc(db, "users", uid);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          setDisplayName(data.displayName || "");
        } else {
          console.warn("User not found");
        }
      } catch (err) {
        console.error("Error loading user:", err);
      }
    };

    if (uid) loadUser();
  }, []);

  

 

  useEffect(() => {
    if (!uid) return;
    const q1 = query(
      collection(db, 'sessions'),
      where('ownerId', '==', uid),
      orderBy('startedAt', 'desc')
    );
    const unsub = onSnapshot(q1, (snap) => {
      const rows = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      setSessions(rows);
      setLoading(false);
    }, (err) => {
      console.warn('sessions snapshot error', err);
      setLoading(false);
    });
    return () => unsub();
  }, [uid]);

  const totals = useMemo(() => {
    const totalRuns = sessions.length;
    const scores = sessions.map(s => s.score).filter((n): n is number => Number.isFinite(n as number));
    const avgScore = scores.length ? (scores.reduce((a, b) => a + (b as number), 0) / scores.length) : 0;
    const totalMiles = sessions.reduce((acc, s) => acc + (s.distanceMi || 0), 0);
    return { totalRuns, avgScore, totalMiles };
  }, [sessions]);

  const scoreSeries = useMemo(() => {
    const ordered = [...sessions].reverse();
    return ordered
      .filter(s => typeof s.score === 'number')
      .map((s, i) => {
        const d = s.startedAt?.toDate ? s.startedAt.toDate() : new Date(s.startedAt);
        return { x: d, y: s.score as number, _id: s.id };
      });
  }, [sessions]);

  if (loading) {
    return (
      <View style={[mainStyle.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={COLORS.brand} size="large" />
      </View>
    );
  }

  return (
    <View style={mainStyle.container}>
      <View style={{flexDirection: 'row', justifyContent:'space-between', alignItems:'center'}}>
              <Text style={[mainStyle.title, { marginHorizontal: 15 }]}>Settings</Text>
              <Pressable style={{marginRight: 20}} onPress={() => router.back()}>
                  <Text style={styles.link}>Done</Text>
                </Pressable>
            </View>

        <View style={styles.card}>
         
            <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitials}>
                {(displayName?.[0] ?.[0] ?? 'U').toUpperCase()}
            </Text>
            </View>
          
          
        <View style={styles.field}>
          <Text style={styles.label}>Display name</Text>
          <Text style={styles.sectionTitle}>{displayName}</Text>
        </View>

        
      </View>


    <View style={styles.card}>
          <Text style={styles.cardTitle}>Driving Stats</Text>
          <DrawGraph sessions={sessions} />
    </View>
      

      {busy && (
        <View style={styles.busyOverlay}>
          <ActivityIndicator color={COLORS.brand} />
        </View>
      )}
      <View style={styles.kpiRow}>
        <KPI label="Runs" value={String(totals.totalRuns)} />
        <KPI label="Avg Score" value={totals.avgScore.toFixed(0)} />
        <KPI label="Miles" value={totals.totalMiles.toFixed(1)} />
      </View>

    

      <Text style={[styles.sectionTitle, { marginTop: 10, marginHorizontal: 16 }]}>Previous runs</Text>
      <FlatList
        data={sessions}
        keyExtractor={(it) => it.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => <RunRow item={item} />}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />
    </View>
  );
}

function DrawGraph({ sessions }: { sessions: Array<{ startedAt: any; score?: number }>}) {
    
    const points = useMemo(() => {
    const arr = [...sessions].sort((a,b) => {
      const ta = a.startedAt?.toDate?.() ?? new Date(a.startedAt); 
      const tb = b.startedAt?.toDate?.() ?? new Date(b.startedAt);
      return ta.getTime() - tb.getTime();
    });
    return arr
      .filter(s => typeof s.score === 'number')
      .map(s => ({
        date: s.startedAt?.toDate?.() ?? new Date(s.startedAt),
        value: s.score as number,
      }));
  }, [sessions]);
  console.log('graph points', points);
  if (!points.length) {
        return <Text style={{ color: COLORS.subtext, marginTop: 12 }}>No score data available.</Text>;
  }

    return(
        <View style={{ height: 180, width: '100%' }}>
        <LineGraph
    animated={false}
    style={{ flex: 1 }}
    points={points}
    color="#FF7A00"
    lineThickness={3}
    gradientFillColors={['rgba(255,122,0,0.25)', 'rgba(255,122,0,0.05)']}
    range={{y:{ min: 0, max: 100 }}}
    
  />
    
        </View>
    )
}

function RunRow({ item }: { item: Session }) {
  const started = item.startedAt?.toDate ? item.startedAt.toDate() : new Date(item.startedAt);
  const duration = fmtDuration(item.durationSec || 0);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/summary', params: { sessionId: item.id } })}
      style={styles.runRow}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.runTitle}>{started.toLocaleString()}</Text>
        <Text style={styles.runSub}>
          {`${(item.distanceMi || 0).toFixed(2)} mi · ${duration} · Score ${item.score?.toFixed(2) ?? '—'}`}
        </Text>
      </View>
      <Text style={styles.runChevron}>›</Text>
    </Pressable>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}


const styles = StyleSheet.create({
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    gap: 10,
    marginTop: 12,
  },
  kpi: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#FFE0C2',
    alignItems: 'center',
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
  },
  kpiLabel: {
    color: COLORS.subtext,
    marginTop: 2,
    fontWeight: '600',
  },
  
  cardTitle: {
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 6,
    fontSize: 16,
  },
  sectionTitle: {
    fontWeight: '800',
    color: COLORS.text,
    fontSize: 16,
    textAlign: "center"
  },

  runRow: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFE0C2',
    flexDirection: 'row',
    alignItems: 'center',
  },
  runTitle: { fontWeight: '700', color: COLORS.text },
  runSub: { color: COLORS.subtext, marginTop: 2 },
  runChevron: { fontSize: 22, color: COLORS.brand, marginLeft: 10, fontWeight: '900' },
  header: {
    marginTop: 30,
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
  },
  link: {
    color: COLORS.brand,
    fontWeight: '700',
    fontSize: 16,
  },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    alignItems: "center",
    justifyContent: "center"
  },

  avatarWrap: {
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarFallback: {
    backgroundColor: '#FFE0C2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 34,
    fontWeight: '800',
    color: COLORS.brand,
  },
  changePhoto: {
    marginTop: 8,
    color: COLORS.brand,
    fontWeight: '700',
  },

  field: {
    marginTop: 12,
  },
  label: {
    color: COLORS.subtext,
    marginBottom: 6,
    fontWeight: '600',
    textAlign: "center"
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFF',
    color: COLORS.text,
    fontSize: 16,
  },
  valueText: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '600',
  },


  primaryBtn: {
    marginTop: 10,
    backgroundColor: COLORS.brand,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },

  dangerBtn: {
    marginTop: 6,
    backgroundColor: '#FF3B30',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  dangerBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },

  busyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
