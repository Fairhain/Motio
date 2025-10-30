import { acceptFriendRequest, getFriendRequests, rejectFriendRequest } from "@/services/firebase/friends";
import { auth } from "@/services/firebase/initFirebase";
import { COLORS, mainStyle } from "@/styles";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { FlatList } from "react-native-gesture-handler";

type Friend = { id: string; name: string };

type Pending = {
  requestId: string;
  uid: string;
  displayName: string;
};

export default function Friends() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);
    const [pending, setPending] = useState<Pending[]>([]);

    const uid = auth.currentUser?.uid;

    const [requests, setRequests] = useState<any[]>([])

  useEffect(() => {

    const loadRequests = async () => {
    
      const requests = await getFriendRequests()
      setRequests(requests)
      console.log("Requests: ", requests)
    };

    loadRequests();
    
  }, []);

  


  async function onAccept(r: Pending) {
    if (!uid) return;
    await acceptFriendRequest(r.requestId);
    setPending(p => p.filter(x => x.requestId !== r.requestId));
    setFriends(f => [...f, { id: r.uid, name: r.displayName }]);
  }
  async function onReject(r: Pending) {
    await rejectFriendRequest(r.requestId);
    setPending(p => p.filter(x => x.requestId !== r.requestId));
  }
  

  return (
    <View style={mainStyle.container}>
      <View style={{ marginHorizontal: 15, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={mainStyle.title}>Add Friends</Text>
        <View style={{flexDirection:"row", gap: 20,  alignItems: "center" }}>
            
             <Pressable onPress={() => router.back()}>
                <Text style={{ color: COLORS.brand, fontWeight: "700", fontSize: 16 }}>Done</Text>
            </Pressable>
        </View>
       
      </View>
      

      <View style={{ marginHorizontal: 10, flex: 1 }}>
        {loading ? (
          <ActivityIndicator color={COLORS.brand} />
        ) : (
          <View style={{backgroundColor: "#e1e1e1ff", borderWidth: 0.5, borderRadius: 10,  margin: 10, padding: 5, flexDirection: "row", gap: 10}}>
            <Ionicons name="search-outline" size={24} style={{
                width: 30,
                height:30,
                padding: 3
            }}>

            </Ionicons>
            <TextInput  placeholder="User ID" style={{width: "100%"}}>
            
            </TextInput>
            <Pressable style={{width: "100%",
                backgroundColor: COLORS.brand,
                    padding: 8,
                    borderRadius: 15, 
                    shadowColor: "#FF7A00",
                    shadowOpacity: 0.25,
                    shadowRadius: 4,
                    elevation: 3, 
            }} >
                    <Text style={{
                        textAlign: "center",
                    color: 'white',
                    fontWeight: '700',
                    fontSize: 20,
                    }}>Send Request</Text>
                </Pressable>
          </View>
        )}


        <FlatList
  data={requests}
  keyExtractor={(item, index) => item.id?.toString() ?? index.toString()}
  style={{ marginHorizontal: 16, marginTop: 12 }}
  ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
  renderItem={({ item }) => (
    <View
      style={{
        backgroundColor: '#fff',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: '#FFE0C2',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '700', color: COLORS.text, fontSize: 16 }}>
          {item ?? '(Unknown)'}
        </Text>
        <Text style={{ color: COLORS.subtext, marginTop: 4 }}>
          wants to be your friend!
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable
          onPress={() => onAccept(item)}
          style={{
            backgroundColor: COLORS.brand,
            borderRadius: 8,
            paddingVertical: 6,
            paddingHorizontal: 12,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>Accept</Text>
        </Pressable>

        <Pressable
          onPress={() => onReject(item)}
          style={{
            borderColor: '#ccc',
            borderWidth: 1,
            borderRadius: 8,
            paddingVertical: 6,
            paddingHorizontal: 12,
          }}
        >
          <Text style={{ color: '#555', fontWeight: '700' }}>Reject</Text>
        </Pressable>
      </View>
    </View>
  )}
/>

      </View>

    </View>
  );
}
