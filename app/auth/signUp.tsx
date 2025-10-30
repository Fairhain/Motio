import { setDisplayName, signInWithEmail, signUpWithEmail } from '@/services/firebase/firebaseAuth';
import { mainStyle } from '@/styles';
import { Link, router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, TextInput, View } from 'react-native';

export default function SignUp() {
    const [userName, setUsername] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }
    try {
      setSubmitting(true);
      await signUpWithEmail(email.trim(), password);
        await setDisplayName(userName);
        await signInWithEmail(email.trim(), password);
      
      router.navigate('/');
    } catch (e: any) {
      const code = e?.code ?? '';
      if (code === 'auth/invalid-email') setError('Invalid email address.');
      else if (code === 'auth/user-not-found' || code === 'auth/wrong-password')
        setError('Incorrect email or password.');
      else if (code === 'auth/too-many-requests')
        setError('Too many attempts. Try again later.');
      else setError(e?.message ?? 'Sign-up failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 24, justifyContent: 'center', gap: 12, backgroundColor: "#FFF9F5" }}>
          <Image source={require('../../src/assets/motio_logo.png')} style={{ width: 200, height: 200, alignSelf: 'center', marginBottom: 24 }} />
      
      <Text style={mainStyle.title}>Sign Up</Text>

        
        <View>
        <Text style={{ marginBottom: 6, color: "#333333"  }}>Username</Text>
        <TextInput
            value={userName}
            onChangeText={setUsername}
            placeholder="Bob"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="username"
            style={{
            height: 44, borderColor: '#E0E0E0', borderWidth: 1, borderRadius: 8, paddingHorizontal: 12,
            }}
        />
        </View>

      <View>
        <Text style={{ marginBottom: 6, color: "#333333"  }}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="emailAddress"
          style={{
            height: 44, borderColor: '#E0E0E0', borderWidth: 1, borderRadius: 8, paddingHorizontal: 12,
          }}
        />
      </View>

      <View>
        <Text style={{ marginBottom: 6, color: "#333333" }}>Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
          autoCapitalize="none"
          textContentType="password"
          style={{
            height: 44, borderColor: '#E0E0E0', borderWidth: 1, borderRadius: 8, paddingHorizontal: 12,
          }}
        />
      </View>

      {error ? <Text style={{ color: 'crimson' }}>{error}</Text> : null}

      <Pressable
        onPress={handleSubmit}
        disabled={submitting}
        style={{
          backgroundColor: submitting ? '#999' : '#FF7A00',
          paddingVertical: 12,
          borderRadius: 10,
          alignItems: 'center',
          marginTop: 6,
        }}
      >
        {submitting ? <ActivityIndicator /> : <Text style={{ color: 'white', fontWeight: '600' }}>Sign Up</Text>}
      </Pressable>

      <Link href="./signIn" style={mainStyle.link}>Sign In</Link>
    </View>
  );
}
