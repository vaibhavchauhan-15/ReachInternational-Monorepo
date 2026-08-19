/**
 * ServiceCentric Mobile — Login Screen
 * Authenticates user credentials via Supabase Auth.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Button, Input, Card, useTheme } from '../../components/ui';
import { spacingNumeric } from '@servicecentric/design-tokens';

export default function LoginScreen() {
  const router = useRouter();
  const { theme } = useTheme();

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
        router.replace('/(app)/dashboard');
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
      style={styles.flexContainer}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.ink }]}>ServiceCentric</Text>
          <Text style={[styles.subtitle, { color: theme.colors.mute }]}>
            Field Operations & Enterprise ERP Mobile
          </Text>
        </View>

        <Card style={styles.card}>
          {errorMessage ? (
            <View style={[styles.errorContainer, { backgroundColor: theme.colors.error + '22', borderColor: theme.colors.error }]}>
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
          />

          <Input
            label="Password"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Button
            label="Sign In"
            onPress={handleLogin}
            isLoading={isLoading}
            fullWidth
            style={styles.loginBtn}
          />

          <Button
            label="Forgot Password?"
            onPress={() => router.push('/(auth)/forgot-password')}
            variant="ghost"
            size="sm"
            style={styles.forgotBtn}
          />
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
    justifyContent: 'center',
    padding: spacingNumeric.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacingNumeric.lg,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    marginTop: spacingNumeric.xxs,
  },
  card: {
    width: '100%',
  },
  errorContainer: {
    padding: spacingNumeric.sm,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: spacingNumeric.md,
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
  },
  loginBtn: {
    marginTop: spacingNumeric.sm,
  },
  forgotBtn: {
    marginTop: spacingNumeric.xs,
  },
});
