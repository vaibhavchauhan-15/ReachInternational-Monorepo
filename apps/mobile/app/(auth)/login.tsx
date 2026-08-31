import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Button, Input, Card, useTheme } from '../../components/ui';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { Mail, Lock, Cpu, BellRing, Activity } from 'lucide-react-native';

export default function LoginScreen() {
  const router = useRouter();
  const { theme, isDark, setMode } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const isSubmittingRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async () => {
    if (isSubmittingRef.current || isLoading) return;
    if (!email || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setErrorMessage('');
    isSubmittingRef.current = true;
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        isSubmittingRef.current = false;
        setIsLoading(false);
      } else if (data.session) {
        // Keep isLoading=true and isSubmittingRef=true during router replace
        router.replace('/(app)/machines');
      }
    } catch (err: unknown) {
      setErrorMessage('An unexpected error occurred during login.');
      isSubmittingRef.current = false;
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.flexContainer, { backgroundColor: theme.colors.canvas }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Soft Background Reach Blue Ambient Glow */}
        <View style={[styles.ambientGlowTop, { backgroundColor: '#00AEEF12' }]} />

        {/* Top Header Logo */}
        <View style={styles.topHeader}>
          <View style={styles.brandRow}>
            <View style={[styles.logoEmblem, { backgroundColor: theme.colors.ink }]}>
              <Text style={[styles.logoLetter, { color: theme.colors.canvas }]}>R</Text>
            </View>
            <View>
              <Text style={[styles.brandTitle, { color: theme.colors.ink }]}>Reach International</Text>
              <Text style={{ fontSize: 9, fontWeight: '700', letterSpacing: 0.8, color: '#00AEEF', textTransform: 'uppercase' }}>
                Fleet Operations Platform
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => setMode(isDark ? 'light' : 'dark')}
            style={[styles.themeBtn, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}
          >
            <Text style={{ fontSize: 11, fontWeight: '600', color: theme.colors.mute }}>
              {isDark ? 'LIGHT' : 'DARK'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Form Card */}
        <Card variant="elevated" style={styles.card}>
          <Text style={[styles.formTitle, { color: theme.colors.ink }]}>Welcome back</Text>

          {errorMessage ? (
            <View style={[styles.errorContainer, { backgroundColor: theme.colors.error + '1a', borderColor: theme.colors.error }]}>
              <Text style={[styles.errorText, { color: theme.colors.error }]}>{errorMessage}</Text>
            </View>
          ) : null}

          <Input
            label="Email Address"
            placeholder="vaibhav@company.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            leftIcon={<Mail size={16} color={theme.colors.mute} />}
          />

          <Input
            label="Password"
            placeholder="••••••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            leftIcon={<Lock size={16} color={theme.colors.mute} />}
          />

          <Button
            label="Sign in"
            onPress={handleLogin}
            isLoading={isLoading}
            shape="square"
            fullWidth
            style={styles.loginBtn}
          />

          <View style={styles.forgotRow}>
            <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')}>
              <Text style={[styles.forgotLink, { color: '#00AEEF' }]}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.signupPromptRow}>
            <Text style={[styles.signupPromptText, { color: theme.colors.mute }]}>Don&apos;t have access?</Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
              <Text style={[styles.signupPromptLink, { color: '#00AEEF' }]}>Request Access</Text>
            </TouchableOpacity>
          </View>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flexContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacingNumeric.lg,
    paddingTop: 56,
    paddingBottom: 40,
    justifyContent: 'center',
    position: 'relative',
  },
  ambientGlowTop: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 250,
    height: 250,
    borderRadius: 125,
  },
  ambientGlowBottom: {
    position: 'absolute',
    bottom: -50,
    left: -50,
    width: 250,
    height: 250,
    borderRadius: 125,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacingNumeric.lg,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoEmblem: {
    width: 36,
    height: 36,
    borderRadius: radiusNumeric.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: {
    fontSize: 18,
    fontWeight: '800',
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  themeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  card: {
    width: '100%',
    padding: spacingNumeric.lg,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: spacingNumeric.md,
  },
  errorContainer: {
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    marginBottom: spacingNumeric.md,
  },
  errorText: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  loginBtn: {
    marginTop: spacingNumeric.sm,
  },
  forgotRow: {
    alignItems: 'center',
    marginTop: spacingNumeric.sm,
  },
  forgotLink: {
    fontSize: 12,
    fontWeight: '600',
  },
  signupPromptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacingNumeric.md,
    paddingTop: spacingNumeric.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150,150,150,0.15)',
  },
  signupPromptText: {
    fontSize: 12,
  },
  signupPromptLink: {
    fontSize: 12,
    fontWeight: '700',
  },
});
