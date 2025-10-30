import { COLORS, mainStyle } from "@/styles";
import { useRouter } from "expo-router";
import { getAuth, signOut } from "firebase/auth";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function Settings() {
  const auth = getAuth();
  const router = useRouter();
  const user = auth.currentUser;
  const [notifications, setNotifications] = React.useState(true);
    const [metric, setMetric] = React.useState(false);


  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/auth/signIn");
  };

  return (
    <View style={mainStyle.container}>
      <View style={{flexDirection: 'row', justifyContent:'space-between', alignItems:'center'}}>
        <Text style={[mainStyle.title, {  margin: 15 }]}>Settings</Text>
        <Pressable style={{ marginRight: 20}} onPress={() => router.back()}>
            <Text style={styles.link}>Done</Text>
          </Pressable>
      </View>
      <View style={styles.profileCard}>
       <View style={{
          width: 48,
          height: 48,
          borderRadius: 48,
        
          backgroundColor: '#FFE0C2',
          justifyContent: 'center',
          alignItems: 'center',
                    
        }}>
          <Text style={{fontSize: 30,
              fontWeight: '800',
              color: COLORS.brand,
            }}>K</Text>
        </View>
        <View style={{ marginLeft: 12 }}>
          <Text style={styles.name}>{user?.displayName ?? "Driver"}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          
        </View>
        
      </View>

      <View style={styles.optionsContainer}>
        <Pressable onPress={() => router.navigate("/profile")} style={styles.optionButton}>
          <Text style={styles.optionText} >Edit Profile</Text>
                    <Text style={styles.optionText}> {">"} </Text>

        </Pressable>
        <Pressable onPress={() => setNotifications(!notifications)} style={styles.optionButton}>
          <Text style={styles.optionText}>Notifications</Text>
          <View>
            <Text style={styles.optionText}>{notifications ? "On" : "Off"}</Text>
          </View>

        </Pressable>
        <Pressable onPress={() => setMetric(!metric)} style={styles.optionButton}>
          <Text style={styles.optionText}>Units</Text>
          <View>
            <Text style={styles.optionText}>{metric ? "Metric" : "Imperial"}</Text>
          </View>

        </Pressable>
        <Pressable  style={styles.optionButton}>
          <Text style={styles.optionText}>Privacy</Text>
          <Text style={styles.optionText}>{">"}</Text>

        </Pressable>
      </View>

      <Pressable onPress={handleLogout} style={styles.logoutButton}>
        <Text style={styles.logoutText}>Log Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    margin: 20,
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    borderWidth: 1,
    borderColor: "#FFE0C2",
  },
  avatar: {
    height: 60,
    width: 60,
    borderRadius: 30,
    backgroundColor: "#FF7A00",
  },
  name: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  email: {
    fontSize: 14,
    color: "#777",
  },
  optionsContainer: {
    marginHorizontal: 20,
    marginTop: 20,
  },
  optionButton: {
    backgroundColor: "#FFF",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FFE0C2",
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  optionText: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: "500",
  },
  logoutButton: {
    backgroundColor: "#FF7A00",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 10,
    margin: 20,
    alignItems: "center",
  },
  logoutText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
  link: {
    color: COLORS.brand,
    fontWeight: '700',
    fontSize: 16,
  },

});
