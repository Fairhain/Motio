import { fetchFeed } from "@/services/firebase/feed";
import { getCurrentUser, signOut } from "@/services/firebase/firebaseAuth";
import { getFriendName, listFriendIds } from "@/services/firebase/friends";
import { auth } from "@/services/firebase/initFirebase";
import { COLORS, mainStyle } from "@/styles";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Timestamp } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import MapView, { Polyline } from "react-native-maps";

type LatLng = {
    lat: number;
    lng: number;
}
function fmtDuration(sec = 0) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
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


function polyCoords(track: LatLng[]){
     if (!Array.isArray(track) || track.length === 0) return [];
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
  };

export default function Home() {
  const user = getCurrentUser();
  const [profileVisible, setProfileVisible] = useState(false);
  const [topItem, setTopItem] = useState<FeedItem>()
  const [topDisplayName, setTopDisplayName] = useState<string | undefined>()



  useEffect(() => {
      (async () => {
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        const friends = await listFriendIds(uid);
        const owners = Array.from(new Set([uid, ...friends]));
        const feed = await fetchFeed(owners, 30);
        
        setTopItem(feed[0]);

        setTopDisplayName(await getFriendName(feed[0].ownerId))
        console.log(topDisplayName)
        console.log(topItem?.ownerId)

      })();
    }, []);
  
  return (
    <ScrollView style={styles.container}>

      <View style={styles.topBar}>

        <Text style={styles.logoText}>Motio</Text>
      
        <Ionicons name="person-circle" size={40} onPress={() => setProfileVisible(!profileVisible)} style={{
          height: 40, width: 40,
          borderRadius: "50%",
          position: "absolute",
          right: 20,
          top: 10,}}>

          </Ionicons>

      </View>

      <View style={styles.welcomeSection}>
        <Text style={mainStyle.title}>
          Welcome {user?.displayName ?? "Driver"}!
        </Text>
        <Text style={mainStyle.subtitle}>
          Drive smarter. Drive safer.
        </Text>
      </View>

      <View style={styles.introCard}>
        <Text style={styles.introText}>
          Welcome to Motio — helping you become a safer, more confident driver
          through smart feedback and insights.
        </Text>
      </View>

      <View style={styles.actionCard}>
        <Text style={styles.cardTitle}>Ready to hit the road?</Text>
        <Pressable onPress={() => router.navigate("/drivingSession")} style={styles.startButton}>
          <Text style={styles.startButtonText}>Start Driving</Text>
        </Pressable>
      </View>
      <View style={[styles.actionCard, {marginTop: 15}]}>
        <Text style={[styles.cardTitle, {marginBottom: 0}]}>Watch Out!</Text>
        <Text style={[mainStyle.subtitle, {textAlign: "center", marginBottom: 10}]}>Many other people have had trouble in these areas!</Text>

        <Pressable onPress={() => router.navigate("/hotspots")} style={styles.startButton}>
          <Text style={styles.startButtonText}>Check out the hotspots</Text>
        </Pressable>
      </View>

      <View style={styles.socialSection}>
        <View style={styles.socialHeader}>
          <Text style={styles.sectionTitle}>Your Feed</Text>
          <Text style={mainStyle.link} onPress={() => router.navigate('/feed')}>See More</Text>
        </View>

        <View style={styles.socialCard}>
          <Text style={[styles.friendName, {color: "black"}]}>{topDisplayName ?? 'Latest Drive'}</Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{topItem ? (topItem.distanceMi ?? 0).toFixed(2) : '—'} mi</Text>
              <Text style={styles.statLabel}>Distance</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{fmtDuration(topItem?.durationSec)}</Text>
              <Text style={styles.statLabel}>Time</Text>
            </View>
            <View style={styles.stat}> 
              <Text style={styles.statValue}>
                {topItem?.eventCounts
                ? Object.values(topItem.eventCounts)
                    .reduce((sum, e: any) => sum + (e.count ?? 0), 0)
                : 0}
              </Text>
              <Text style={styles.statLabel}>Events</Text>
            </View>
          </View>
      {topItem && (
        <MapView
          style={styles.mapPreview}
          region={{
            latitude:  topItem.bbox
    ? (topItem.bbox.minLat + topItem.bbox.maxLat) / 2
    : 37.7749,
            longitude: topItem.bbox
    ? (topItem.bbox.minLng + topItem.bbox.maxLng) / 2
    : 37.7749,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          scrollEnabled={false}
          rotateEnabled={false}
          zoomEnabled={false}
        >
          {drawPolyline(topItem)}
        </MapView>
      )}
        </View>
      </View>




      <Modal
        visible={profileVisible}
        animationType="none"
        transparent={true}
        onRequestClose={() => setProfileVisible(false)}

      >
        <Pressable
    style={styles.backdrop}
    onPress={() => setProfileVisible(false)}
  >
    <Pressable onPress={(e) => e.stopPropagation()} style={styles.menuCard}>
      <View style={styles.menuHeader}>
        <View style={{

              width: 48,
              height: 48,
              borderRadius: 48,
            
              backgroundColor: '#FFE0C2',
              justifyContent: 'center',
              alignItems: 'center',
                        
        }}>
          <Text style={{fontSize: 24,
              fontWeight: '800',
              color: COLORS.brand,
            }}>K</Text>
        </View>
        
        <View style={{ flex: 1 }}>
          <Text style={styles.menuName}>
            {user?.displayName ?? "Driver"}
          </Text>
          {user?.email ? (
            <Text style={styles.menuEmail}>{user.email}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.separator} />

      <Pressable
        style={styles.menuItem}
        onPress={() => {
          setProfileVisible(false);
          router.navigate("/profile"); 
        }}
      >
        <Text style={styles.menuItemText}>View Profile</Text>
        <Ionicons name="chevron-forward" size={18} color="#999" />
      </Pressable>

      <Pressable
        style={styles.menuItem}
        onPress={() => {
          setProfileVisible(false);
          router.navigate("/settings"); 
        }}
      >
        <Text style={styles.menuItemText}>Settings</Text>
        <Ionicons name="chevron-forward" size={18} color="#999" />
      </Pressable>

      <Pressable
        style={styles.menuItem}
        onPress={() => {
          setProfileVisible(false);
          router.navigate("/friends/friends")
        }}
      >
        <Text style={styles.menuItemText}>Friends</Text>
        <Ionicons name="chevron-forward" size={18} color="#999" />
      </Pressable>

      <View style={styles.separator} />

      <Pressable
        style={[styles.menuItem, { paddingVertical: 12 }]}
        onPress={async () => {
          try {
            await signOut();
          } finally {
            setProfileVisible(false);
            router.replace("/auth/signIn");
          }
        }}
      >
        <Text style={[styles.menuItemText, { color: "#FF3B30", fontWeight: "700" }]}>
          Sign Out
        </Text>
      </Pressable>
    </Pressable>
  </Pressable>
      </Modal>

    </ScrollView>
  );
}


function drawPolyline(item: FeedItem) {
    const points = polyCoords(item.polyline? item.polyline : [])

    return (
        <View>
        {points.length > 1 && (
            <Polyline
            coordinates={points}
            strokeWidth={5}
            strokeColor={COLORS.brand}       
            />
        )}
        </View>
        
    )
}

const styles = StyleSheet.create({



  container: {
    flex: 1,
    paddingTop: 60,
    backgroundColor: "#FFF9F5",
  },
  topBar: {
    height: 60,
    justifyContent:"center",
    alignItems: "center",
  },
  logoText: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FF7A00",
    letterSpacing: 1.2,
  },
  welcomeSection: {
    marginHorizontal: 20,
    marginTop: 10,
  },
  
  
  introCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    margin: 20,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
  },
  introText: {
    fontSize: 16,
    color: "#555",
    textAlign: "center",
    lineHeight: 22,
  },
  actionCard: {
    backgroundColor: "#FFF",
    borderRadius: 14,
    marginHorizontal: 20,
    paddingVertical: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FFE0C2",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    color: "#333",
  },
  startButton: {
    backgroundColor: "#FF7A00",
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: "#FF7A00",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  startButtonText: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 16,
  },
  socialSection: {
    marginHorizontal: 20,
    marginTop: 20,
    flex: 1,
  },
  socialHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
  },
  
  socialCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    marginTop: 10,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
  },
  friendName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FF7A00",
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 10,
  },
  stat: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
  },
  statLabel: {
    fontSize: 14,
    color: "#777",
  },
  mapPreview: {
    height: 180,
    borderRadius: 10,
  },

  backdrop: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  menuCard: {
    position: "absolute",
    top: 108,
    right: 16,
    minWidth: 240,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EAD9CE",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    paddingVertical: 8,
  },
  menuHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  menuAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFE0C2",
  },
  menuName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333333",
  },
  menuEmail: {
    fontSize: 12,
    color: "#777",
  },
  separator: {
    height: 1,
    backgroundColor: "#F3E9E2",
    marginVertical: 6,
  },
  menuItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  menuItemText: {
    fontSize: 15,
    color: "#333333",
    fontWeight: "600",
  },

});
