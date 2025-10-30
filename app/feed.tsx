import { FeedItem, fetchFeed } from "@/services/firebase/feed";
import { listFriendIds } from "@/services/firebase/friends";
import { db } from "@/services/firebase/initFirebase";
import { COLORS, mainStyle } from "@/styles";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { getAuth } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    Text,
    View,
} from "react-native";
import MapView, { Polyline, PROVIDER_DEFAULT } from "react-native-maps";

function fmtDuration(sec = 0) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}

function pretty(t: string) {
  return t === "hard_brake"
    ? "Hard Brake"
    : t === "rapid_accel"
    ? "Rapid Accel"
    : t === "hard_corner"
    ? "Hard Turn"
    : t === "overspeed"
    ? "Overspeed"
    : t;
}
type LatLng = {
    lat: number;
    lng: number;
}

async function fetchDisplayNamesForOwners(ownerIds: string[]) {
  const unique = Array.from(new Set(ownerIds)).filter(Boolean);
  if (unique.length === 0) return {};

  const CHUNK = 10;
  const out: Record<string, string> = {};

  for (let i = 0; i < unique.length; i += CHUNK) {
    const slice = unique.slice(i, i + CHUNK);
    const qUsers = query(
      collection(db, "users"),
      where("__name__", "in", slice)
    );
    const snap = await getDocs(qUsers);
    snap.docs.forEach((d) => {
      const data = d.data() as any;
      out[d.id] = data?.displayName || "(unknown)";
    });
  }
  return out; 
}

const LIKES_KEY = "@sessionLikes"; 

async function loadLikes(): Promise<Record<string, boolean>> {
  try {
    const raw = await AsyncStorage.getItem(LIKES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
async function saveLikes(obj: Record<string, boolean>) {
  try {
    await AsyncStorage.setItem(LIKES_KEY, JSON.stringify(obj));
  } catch {}
}
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

export default function Feed() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [ownerNames, setOwnerNames] = useState<Record<string, string>>({});
  const [likes, setLikes] = useState<Record<string, boolean>>({});
  const auth = getAuth();

  useEffect(() => {
    (async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const friends = await listFriendIds(uid);
      const owners = Array.from(new Set([uid, ...friends]));
      const feed = await fetchFeed(owners, 30);
      setItems(feed);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const ownerIds = items.map((it) => it.ownerId as string);
      const map = await fetchDisplayNamesForOwners(ownerIds);
      setOwnerNames(map);

      const stored = await loadLikes();
      setLikes(stored);
    })();
  }, [items]);

  const toggleLike = async (sessionId: string) => {
    setLikes((prev) => {
      const next = { ...prev, [sessionId]: !prev[sessionId] };
      saveLikes(next);
      return next;
    });
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={mainStyle.container}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text
          style={{
            paddingHorizontal: 20,
            paddingBottom: 8,
            alignItems: "flex-end",
            fontSize: 28,
            fontWeight: "800",
            color: COLORS.text,
          }}
        >
          Friends Feed
        </Text>
        <Pressable style={{ marginRight: 20 }} onPress={() => router.back()}>
          <Text
            style={{
              color: COLORS.brand,
              fontWeight: "700",
              fontSize: 16,
            }}
          >
            Done
          </Text>
        </Pressable>
      </View>

      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        renderItem={({ item }) => (
          <FeedCard
            item={item}
            displayName={ownerNames[item.ownerId] || "(unknown)"}
            liked={!!likes[item.id]}
            onToggleLike={() => toggleLike(item.id)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        contentContainerStyle={{ paddingBottom: 24, padding: 15 }}
      />
    </View>
  );
}

function FeedCard({
  item,
  displayName,
  liked,
  onToggleLike,
}: {
  item: FeedItem;
  displayName: string;
  liked: boolean;
  onToggleLike: () => void;
}) {
  const centerLat = item.bbox
    ? (item.bbox.minLat + item.bbox.maxLat) / 2
    : 37.7749;

    const centerLng = item.bbox
    ? (item.bbox.minLng + item.bbox.maxLng) / 2
    : -122.4194;

    const region = {
    latitude: centerLat,
    longitude: centerLng,
    latitudeDelta: Math.max(0.02, Math.abs((item.bbox?.maxLat ?? centerLat) - (item.bbox?.minLat ?? centerLat)) * 1.5),
    longitudeDelta: Math.max(0.02, Math.abs((item.bbox?.maxLng ?? centerLng) - (item.bbox?.minLng ?? centerLng)) * 1.5),
    };
    

  const started =
    (item.startedAt as any)?.toDate?.() ?? new Date(item.startedAt as any);

  return (
    <Pressable
      style={{
        backgroundColor: "#fff",
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: "#FFE0C2",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontWeight: "800", color: COLORS.brand }}>
              {(displayName?.[0] ?? "?").toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={{ fontSize: 15, fontWeight: "700", color: COLORS.text }}>
              {displayName}
            </Text>
            <Text style={{ color: COLORS.subtext, fontSize: 12 }}>
              {started.toLocaleString()}
            </Text>
          </View>
        </View>

        <Pressable
          hitSlop={8}
          onPress={(e) => {
            e.stopPropagation(); 
            onToggleLike();
          }}
          style={{
            paddingHorizontal: 8,
            paddingVertical: 6,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Ionicons
            name={liked ? "heart" : "heart-outline"}
            size={20}
            color={liked ? "#FF3B30" : "#888"}
          />
          <Text style={{ color: liked ? "#FF3B30" : "#888", fontWeight: "700" }}>
            Like
          </Text>
        </Pressable>
      </View>

      <Text style={{ color: COLORS.subtext, marginBottom: 8 }}>
        {item.distanceMi?.toFixed?.(2) ?? "0.00"} mi · {fmtDuration(item.durationSec)} · Score:{" "}
        {item.score.toFixed(2) ?? "—"} · Events: {item?.eventCounts
            ? Object.values(item.eventCounts)
                .reduce((sum, e: any) => sum + (e.count ?? 0), 0)
            : 0}
      </Text>
      

      <View style={{ height: 140, borderRadius: 8, overflow: "hidden" }}>
        <MapView
          provider={PROVIDER_DEFAULT}
          pointerEvents="none"
          style={{ flex: 1 }}
          region={region}
          scrollEnabled={false}
          rotateEnabled={false}
          zoomEnabled={false}
        >
            
          {drawPolyline(item)}
        </MapView>
      </View>

     
    </Pressable>
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

function Badge({ label }: { label: string }) {
  return (
    <View
      style={{
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 999,
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: COLORS.border,
      }}
    >
      <Text style={{ fontSize: 12, color: COLORS.subtext }}>{label}</Text>
    </View>
  );
}
