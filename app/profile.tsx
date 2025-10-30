import { db } from '@/services/firebase/initFirebase';
import { COLORS, mainStyle } from '@/styles';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { getAuth, updateProfile } from 'firebase/auth';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import { default as React, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
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

function fmtDate(d: Date) {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); 
}


export default function Profile() {
  const auth = useMemo(() => getAuth(), []);
  const uid = auth.currentUser?.uid;
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);

  const user = auth.currentUser;

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [email] = useState(user?.email ?? '');
  const [photoURL, setPhotoURL] = useState<string | null>(user?.photoURL ?? null);
  const [busy, setBusy] = useState(false);



  useEffect(() => {
    (async () => {
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    })();
  }, []);

  const pickAndUploadAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: [1, 1],
      });
      if (result.canceled) return;
      const uri = result.assets?.[0]?.uri;
      if (!uri || !user) return;

      setBusy(true);

      const res = await fetch(uri);
      const blob = await res.blob();

      const storage = getStorage();
      const storageRef = ref(storage, `profilePictures/${user.uid}.jpg`);
      await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
      const url = await getDownloadURL(storageRef);

      await updateProfile(user, { photoURL: url });
      await auth.currentUser?.reload();
      setPhotoURL(url);
      Alert.alert('Profile photo updated');
    } catch (e: any) {
      console.warn(e);
      Alert.alert('Upload failed', e?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const saveDisplayName = async () => {
    if (!user) return;
    if (!displayName.trim()) {
      Alert.alert('Please enter a name');
      return;
    }
    try {
      setBusy(true);
      await updateProfile(user, { displayName: displayName.trim() });
      await auth.currentUser?.reload();
      Alert.alert('Name updated');
    } catch (e: any) {
      console.warn(e);
      Alert.alert('Update failed', e?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    try {
      setBusy(true);
      await auth.signOut();
      router.replace('/auth/signIn');
    } catch (e: any) {
      Alert.alert('Sign out failed', e?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  };


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
    <ScrollView style={mainStyle.container}>
      <View style={{flexDirection: 'row', justifyContent:'space-between', alignItems:'center'}}>
              <Text style={[mainStyle.title, {  marginHorizontal: 15 }]}>Profile</Text>
              <Pressable style={{ marginRight: 20}} onPress={() => router.back()}>
                  <Text style={styles.link}>Done</Text>
                </Pressable>
            </View>

        <View style={styles.card}>
        <Pressable onPress={pickAndUploadAvatar} style={styles.avatarWrap}>
          {photoURL ? (
            <Image source={{ uri: photoURL }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitials}>
                {(displayName?.[0] ?? email?.[0] ?? 'U').toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.changePhoto}>Change photo</Text>
        </Pressable>

        <View style={styles.field}>
          <Text style={styles.label}>Display name</Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your name"
            style={styles.input}
            autoCapitalize="words"
          />
          <Pressable onPress={saveDisplayName} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Save</Text>
          </Pressable>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.valueText}>{email || '—'}</Text>
        </View>
      </View>


    <View style={styles.card}>
          <Text style={styles.cardTitle}>Driving Score Over Time</Text>
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
      scrollEnabled={false}
        
        data={sessions}
        keyExtractor={(it) => it.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => <RunRow item={item} />}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        style={{height: 200, marginBottom: 40}}
      />
    </ScrollView>
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
        .map((s) => {
        const date = s.startedAt?.toDate?.() ?? new Date(s.startedAt);
        const value = Number(s.score);           
        return { date, value };
        })
        
    }, [sessions]);
  console.log('graph points', points);

  if (!points.length) {
        return <Text style={{ color: COLORS.subtext, marginTop: 12 }}>No score data available.</Text>;
  }
  const first = points[0].date;
  const last = points[points.length - 1].date;
  const mid = points[Math.floor(points.length / 2)].date;
  const [selected, setSelected] = useState<{ date: Date; value: number } | null>(null);

    return(
        <View style={{ height: 180, width: '100%' }}>
        <Text style={[mainStyle.subtitle, { marginBottom: 8 }]}>
            {selected
            ? `Score: ${Math.round(selected.value)} • ${fmtDate(selected.date)}`
            : ''}
        </Text>
      <LineGraph
    
  animated={true}
  style={{ flex: 1 }}
  points={points}
  color="#FF7A00"
  lineThickness={3}
  enablePanGesture={true}
  onPointSelected={(p) => setSelected(p)}
  onGestureEnd={() => setSelected(null)}
  range={{ y: { min: 0, max: 105 } }}
/>
<View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingHorizontal: 4, borderTopWidth: 2, paddingTop: 4, }}>
        <Text style={{ color: COLORS.subtext, fontSize: 12 }}>{fmtDate(first)}</Text>
        <Text style={{ color: COLORS.subtext, fontSize: 12 }}>{fmtDate(mid)}</Text>
        <Text style={{ color: COLORS.subtext, fontSize: 12 }}>{fmtDate(last)}</Text>
      </View>        
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
          {`${(item.distanceMi || 0).toFixed(2)} mi · ${duration} · Score ${item.score.toFixed(2) ?? '—'}`}
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
    marginVertical: 10
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
