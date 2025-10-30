import { detectClusters, fetchEventsInView } from "@/services/hotspot";
import { COLORS, mainStyle } from "@/styles";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import MapView, { Circle, Marker } from "react-native-maps";

export default function HotSpots() {
    const [events, setEvents] = useState<Array<{ lat: number; lng: number }>>([]);
    const [clusters, setClusters] = useState<Array<{ lat: number; lng: number }>>([]);

    const [loading, setLoading] = useState(false);
    const mapRef = useRef<MapView>(null);
    useEffect(() => {
  (async () => {
    const bbox = {
      minLat: 34.159608902501766 - 0.1 / 2,
      maxLat: 34.159608902501766 + 0.1 / 2,
      minLng: -118.81724197714216 - 0.1 / 2,
      maxLng: -118.81724197714216 + 0.1 / 2,
    };

    console.log(bbox);
    setLoading(true);

    try {
      const data = await fetchEventsInView(bbox);
      setEvents(data);

      const clusters = detectClusters(data);
      setClusters(clusters);

      console.log("clusters", clusters);
    } catch (e) {
      console.warn("Failed to fetch events:", e);
    } finally {
      setLoading(false);
    }
  })();
}, []);
    const onRegionChangeComplete = useCallback(async (region: { latitude: number; latitudeDelta: number; longitude: number; longitudeDelta: number; }) => {
        const bbox = {
            minLat: region.latitude - region.latitudeDelta / 2,
            maxLat: region.latitude + region.latitudeDelta / 2,
            minLng: region.longitude - region.longitudeDelta / 2,
            maxLng: region.longitude + region.longitudeDelta / 2,
        };
        console.log(bbox)
        setLoading(true);
        try {
            const data = await fetchEventsInView(bbox);
            setEvents(data);
            const clusters = detectClusters(data);
            setClusters(clusters);
            console.log(clusters);
        } catch (e) {
            console.warn('Failed to fetch events:', e);
        } finally {
            setLoading(false);
        }
    }, []);
    

    return (
        <View style={{flex: 1}}>
        <MapView
      ref={mapRef}
        style={{
            flex: 1
        }}
        showsUserLocation
        initialRegion={{
          latitude: 34.159608902501766,
          longitude: -118.81724197714216,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        onRegionChangeComplete={onRegionChangeComplete}
        
      > 
        {
            clusters.map((e, i) => (
            <View key={i}><Marker
                    
                    coordinate={{ latitude: e.lat, longitude: e.lng }}
                    pinColor={COLORS.brand} /><Circle
                        center={{ latitude: e.lat, longitude: e.lng }}
                        radius={1*200}
                        strokeColor="transparent"
                        fillColor="rgba(232, 111, 0, 0.5)" /></View>
        ))}
        {events.map((e, i) => (
        <Marker
            key={i}
            coordinate={{ latitude: e.lat, longitude: e.lng }}
            pinColor={COLORS.danger}
        />
        ))}
        
      </MapView>
      <View style={[mainStyle.sheet, {height: 100}]}>
       
        
          <Pressable style={{width: "100%",
           backgroundColor: COLORS.brand,
            padding: 8,
             borderRadius: 15, 
             shadowColor: "#FF7A00",
            shadowOpacity: 0.25,
            shadowRadius: 4,
            elevation: 3, 
    }} onPress={() => router.navigate("/")}>
            <Text style={{
                textAlign: "center",
              color: 'white',
              fontWeight: '700',
              fontSize: 20,
            }}>Exit</Text>
          </Pressable>
      </View>
    </View>
    )
}