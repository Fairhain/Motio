import { AuthContext } from "@/context/AuthContext";
import { useRouter } from "expo-router";
import { } from "firebase/auth";
import { useContext, useEffect } from "react";
import 'react-native-get-random-values';

export default function Index() {
  const { user, loading } = useContext(AuthContext);
  const router = useRouter();
  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/auth/signIn');   
      } else {
        router.replace('/home');
      }
    }
  }, [user, loading]);
  return null;
}

