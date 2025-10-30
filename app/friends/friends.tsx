import { getFriendName, listFriendIds } from "@/services/firebase/friends";
import { auth, db } from "@/services/firebase/initFirebase";
import { COLORS, mainStyle } from "@/styles";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { collection, getDocs, query, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";

type Friend = { id: string; name: string };

export default function Friends() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
    const uid = auth.currentUser?.uid;
const [rankings, setRankings] = useState<Array<{name: string, average:number}>>([])


  useEffect(() => {
    let cancelled = false;
    console.log("Time: ", Date.now())

    const loadFriends = async () => {
      try {
        if (!uid) return;

        const friendIds = await listFriendIds(uid);

        const friendNames: Friend[] = await Promise.all(
          friendIds.map(async (id) => {
            try {
              const name = await getFriendName(id);
              return { id: id, name };
            } catch {
              return { id: id, name: "(unknown)" };
            }
          })
        );

        if (!cancelled) setFriends(friendNames);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadFriends();
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (!uid) return;
    (async () => {
      ranking()
    })();
  }, [friends, uid]);

  async function ranking() {
    const rankings: Array<{name: string, average: number}> = []
    for (const f of friends) {
        const q = query(collection(db, "sessions"), where("ownerId", "==", f.id));
        const snap = await getDocs(q);
        if (snap.empty) {rankings.push({name: f.name, average: 0})}
        else {

        let totalScore = 0
        snap.forEach((s) => {
            const data = s.data()
            if (data.score) {totalScore += data.score}
        })
        rankings.push({name: f.name, average: (totalScore/snap.size)})
        }
    }
    const q = query(collection(db, "sessions"), where("ownerId", "==", uid));
    const snap = await getDocs(q);
    if (snap.empty) {rankings.push({name: auth.currentUser?.displayName, average: 0})}
    else {
        let totalScore = 0
        snap.forEach((s) => {
            const data = s.data()
            console.log(data.score)

            if (data.score) {totalScore += data.score}
        })
        rankings.push({name: auth.currentUser?.displayName, average: (totalScore/snap.size)})

    }
    rankings.sort((a, b) => b.average - a.average);
    console.log(rankings)
    setRankings(rankings)
  }


  function routeToProfile(uid: string) {
      router.push({ pathname: "/otherProfile", params: { uid } }); 
  }
  

  return (
    <View style={mainStyle.container}>
      <View style={{ marginHorizontal: 15, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={mainStyle.title}>Friends</Text>
        <View style={{flexDirection:"row", gap: 20,  alignItems: "center" }}>
            <Text onPress={() => router.navigate("/friends/addFriends")} style={[mainStyle.title, {marginVertical: "auto", color: COLORS.brand}]}>
                +
            </Text>
             <Pressable onPress={() => router.back()}>
                <Text style={{ color: COLORS.brand, fontWeight: "700", fontSize: 16 }}>Done</Text>
            </Pressable>
        </View>
        
       
      </View>
      <View style={[mainStyle.card, {marginTop: 10}]}>

        <View style={{flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,}}>
        <Ionicons  name="trophy-outline" size={40} color={COLORS.brand} />

            <Text style={{fontWeight: "800",
    fontSize: 16,
    color: COLORS.text,
       }}>Weekly Leaderboard</Text>
        </View>
       <View style={{flexDirection: "row", borderBottomWidth: 0.5, borderColor: COLORS.subtext, paddingBottom: 3}}>
        <Text style={{fontWeight: 700, color: COLORS.text, marginLeft: 25}}>Name</Text>

        <Text style={{fontWeight: 700, color: COLORS.text, marginLeft: 237}}>Score</Text>

       </View>
        <FlatList
            style={{ marginTop: 10 }}
            data={rankings}
            keyExtractor={(item) => `${item.name}-${Math.round(item.average * 10)}`}
            renderItem={({ item, index }) => (
                <RankItem item={item} index={index} />
            )}
            >
        </FlatList>
      </View>


      <View style={{ marginHorizontal: 10, flex: 1 }}>
        <Text style={{marginLeft: 16,
    marginBottom: 8,
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.text,}}>Your Friends</Text>

        {loading ? (
          <ActivityIndicator color={COLORS.brand} />
        ) : (
          <FlatList
            data={friends}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View  style={{flexDirection: "row", justifyContent: "space-between", alignItems: "center"}}>
                <View style={{flexDirection:"row", gap: 20}}>
                    <View style={{width: 50,
    height: 50,
    borderRadius: 48,
    backgroundColor: '#FFE0C2',
    justifyContent: 'center',
    alignItems: 'center',}}>
                    <Text style={{fontSize: 34,
    fontWeight: '800',
    color: COLORS.brand,}}>
                        {(item.name?.[0] ?? 'U').toUpperCase()}
                   </Text>
                </View>
                <View>
                    <Text style={[mainStyle.title, {fontSize:23}]}>{item.name}</Text>
                    <Text style={[mainStyle.subtitle, {fontSize: 14, marginTop: 1}]}>#{item.id}</Text>
                </View>
                </View>
                
                <Pressable onPress={() => routeToProfile(item.id)} style={{marginVertical: "auto", padding: 10, backgroundColor: COLORS.brand, borderRadius: 10}}>
                    <Text style={{color: "white", fontWeight: 700, fontSize: 14}}>
                        View Profile
                    </Text>
                </Pressable>
              </View>
            )}
            ItemSeparatorComponent={() => <View style={{ height: 15}} />}
          />
        )}
      </View>
    </View>
  );
}

function RankItem({ item, index }: { item: {name: string, average: number}; index: number }) {
  const medal =
    index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}.`;
    let isUser = false;
    if (item.name==auth.currentUser?.displayName) return (
         <View style={{flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 4,    
    backgroundColor: "#e1e1e1ff",
    borderRadius: 10
}}>
      <Text style={{width: 28,
    textAlign: "center",
    fontSize: 16,
}}>{medal}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{color: COLORS.text, fontWeight: "700"}}>{item.name}</Text>
      </View>
      <Text style={{fontWeight: "800",
    color: COLORS.brand,
    fontVariant: ["tabular-nums"],
    minWidth: 52,
    textAlign: "right",
      }}>{item.average.toFixed(1)}</Text>
    </View>
    )
  return (
    <View style={{flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 4,}}>
      <Text style={{width: 28,
    textAlign: "center",
    fontSize: 16,
}}>{medal}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{color: COLORS.text, fontWeight: "700"}}>{item.name}</Text>
      </View>
      <Text style={{fontWeight: "800",
    color: COLORS.brand,
    fontVariant: ["tabular-nums"],
    minWidth: 52,
    textAlign: "right",
      }}>{item.average.toFixed(1)}</Text>
    </View>
  );
}