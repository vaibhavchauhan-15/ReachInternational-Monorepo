import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Button, Input, Card, useTheme } from '../../components/ui';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { Mail, ArrowLeft } from 'lucide-react-native';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { theme, isDark, setMode } = useTheme();

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const isSubmittingRef = useRef(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleReset = async () => {
    if (isSubmittingRef.current || isLoading) return;
    if (!email || !email.includes('@')) {
      setMessage('Please enter a valid registered email address.');
      setIsSuccess(false);
      return;
    }

    setMessage('');
    isSubmittingRef.current = true;
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) {
        setMessage(error.message);
        setIsSuccess(false);
      } else {
        setMessage('Password reset instructions have been sent to your email.');
        setIsSuccess(true);
      }
    } catch (err: unknown) {
      setMessage('Failed to send reset email. Please try again.');
      setIsSuccess(false);
    } finally {
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
        {/* Soft Background Glow */}
        <View style={[styles.ambientGlowTop, { backgroundColor: theme.colors.link + '15' }]} />

        {/* Top Header */}
        <View style={styles.topHeader}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backBtn, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}
          >
            <ArrowLeft size={16} color={theme.colors.ink} />
          </TouchableOpacity>

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

        {/* Card */}
        <Card variant="elevated" style={styles.card}>
          <Text style={[styles.title, { color: theme.colors.ink }]}>Reset Password</Text>
          <Text style={[styles.subtitle, { color: theme.colors.mute }]}>
            Enter your registered email address to receive password recovery instructions.
          </Text>

          {message ? (
            <View
              style={[
                styles.messageBox,
                {
                  backgroundColor: isSuccess ? theme.colors.success + '1a' : theme.colors.error + '1a',
                  borderColor: isSuccess ? theme.colors.success : theme.colors.error,
                },
              ]}
            >
              <Text style={{ color: isSuccess ? theme.colors.success : theme.colors.error, fontSize: 12, textAlign: 'center', fontWeight: '500' }}>
                {message}
              </Text>
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

          <Button
            label="Send Reset Instructions"
            onPress={handleReset}
            isLoading={isLoading}
            shape="square"
            fullWidth
            style={styles.btn}
          />

          <Button
            label="Back to Sign In"
            onPress={() => router.replace('/(auth)/login')}
            variant="ghost"
            size="sm"
            style={styles.backLinkBtn}
          />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flexContainer: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacingNumeric.lg,
    paddingTop: 56,
    paddingBottom: 40,
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
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacingNumeric.xl,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoEmblem: {
    width: 32,
    height: 32,
    borderRadius: radiusNumeric.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: {
    fontSize: 16,
    fontWeight: '800',
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
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
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
    marginBottom: spacingNumeric.md,
  },
  messageBox: {
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    marginBottom: spacingNumeric.md,
  },
  btn: {
    marginTop: spacingNumeric.xs,
  },
  backLinkBtn: {
    marginTop: spacingNumeric.xs,
  },
});
