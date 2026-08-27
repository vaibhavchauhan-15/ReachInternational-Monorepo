import React, { useState } from 'react';
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
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setErrorMessage('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMessage(error.message);
      } else if (data.session) {
        router.replace('/(app)/machines');
      }
    } catch (err: unknown) {
      setErrorMessage('An unexpected error occurred during login.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.flexContainer, { backgroundColor: theme.colors.canvas }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Soft Background Glow Circles */}
        <View style={[styles.ambientGlowTop, { backgroundColor: theme.colors.link + '15' }]} />
        <View style={[styles.ambientGlowBottom, { backgroundColor: theme.colors.violet + '15' }]} />

        {/* Top Header Logo */}
        <View style={styles.topHeader}>
          <View style={styles.brandRow}>
            <View style={[styles.logoEmblem, { backgroundColor: theme.colors.ink }]}>
              <Text style={[styles.logoLetter, { color: theme.colors.canvas }]}>R</Text>
            </View>
            <Text style={[styles.brandTitle, { color: theme.colors.ink }]}>Reach International</Text>
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

        {/* Hero Banner Section */}
        <View style={styles.heroSection}>
          <Text style={[styles.eyebrow, { color: theme.colors.link }]}>
            ENTERPRISE FLEET OPERATIONS
          </Text>
          <Text style={[styles.heroHeadline, { color: theme.colors.ink }]}>
            Industrial machine service & running hours tracking.
          </Text>
          <Text style={[styles.heroSubtext, { color: theme.colors.mute }]}>
            Centralized fleet management, daily shift logs, and instant operational reporting.
          </Text>

          {/* Quick Metrics Bar */}
          <View style={styles.metricsRow}>
            <View style={[styles.metricCard, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
              <Cpu size={14} color={theme.colors.link} />
              <Text style={[styles.metricValue, { color: theme.colors.ink }]}>Live</Text>
              <Text style={[styles.metricLabel, { color: theme.colors.mute }]}>Fleet</Text>
            </View>
            <View style={[styles.metricCard, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
              <BellRing size={14} color={theme.colors.success} />
              <Text style={[styles.metricValue, { color: theme.colors.ink }]}>IST</Text>
              <Text style={[styles.metricLabel, { color: theme.colors.mute }]}>Accurate</Text>
            </View>
            <View style={[styles.metricCard, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
              <Activity size={14} color={theme.colors.violet} />
              <Text style={[styles.metricValue, { color: theme.colors.ink }]}>24/7</Text>
              <Text style={[styles.metricLabel, { color: theme.colors.mute }]}>Sync</Text>
            </View>
          </View>
        </View>

        {/* Form Card */}
        <Card variant="elevated" style={styles.card}>
          <Text style={[styles.formTitle, { color: theme.colors.ink }]}>Account Sign In</Text>
          <Text style={[styles.formSubtitle, { color: theme.colors.mute }]}>Enter your credentials below</Text>

          {errorMessage ? (
            <View style={[styles.errorContainer, { backgroundColor: theme.colors.error + '1a', borderColor: theme.colors.error }]}>
              <Text style={[styles.errorText, { color: theme.colors.error }]}>{errorMessage}</Text>
            </View>
          ) : null}

          <Input
            label="Email Address"
            placeholder="engineer@reachinternation.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            leftIcon={<Mail size={16} color={theme.colors.mute} />}
          />

          <Input
            label="Password"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            leftIcon={<Lock size={16} color={theme.colors.mute} />}
          />

          <Button
            label="Sign In to Platform"
            onPress={handleLogin}
            isLoading={isLoading}
            shape="pill"
            fullWidth
            style={styles.loginBtn}
          />

          <View style={styles.forgotRow}>
            <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')}>
              <Text style={[styles.forgotLink, { color: theme.colors.mute }]}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.signupPromptRow}>
            <Text style={[styles.signupPromptText, { color: theme.colors.mute }]}>Don&apos;t have an account?</Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
              <Text style={[styles.signupPromptLink, { color: theme.colors.link }]}>Request Access</Text>
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
  heroSection: {
    marginBottom: spacingNumeric.lg,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  heroHeadline: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.8,
    lineHeight: 30,
    marginBottom: 6,
  },
  heroSubtext: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: spacingNumeric.md,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  metricCard: {
    flex: 1,
    padding: 8,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  card: {
    width: '100%',
    padding: spacingNumeric.lg,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  formSubtitle: {
    fontSize: 12,
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
