/**
 * ServiceCentric Mobile — Forgot Password Screen
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Button, Input, Card, useTheme } from '../../components/ui';
import { spacingNumeric } from '@servicecentric/design-tokens';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleReset = async () => {
    if (!email) {
      setMessage('Please enter your email address.');
      setIsSuccess(false);
      return;
    }

    setMessage('');
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) {
        setMessage(error.message);
        setIsSuccess(false);
      } else {
        setMessage('Password reset link sent to your email.');
        setIsSuccess(true);
      }
    } catch (err: unknown) {
      setMessage('Failed to send reset email.');
      setIsSuccess(false);
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
          <Text style={[styles.title, { color: theme.colors.ink }]}>Reset Password</Text>
          <Text style={[styles.subtitle, { color: theme.colors.mute }]}>
            Enter your registered email address to receive reset instructions
          </Text>
        </View>

        <Card style={styles.card}>
          {message ? (
            <View
              style={[
                styles.messageBox,
                {
                  backgroundColor: isSuccess ? theme.colors.success + '22' : theme.colors.error + '22',
                  borderColor: isSuccess ? theme.colors.success : theme.colors.error,
                },
              ]}
            >
              <Text style={{ color: isSuccess ? theme.colors.success : theme.colors.error, fontSize: 13 }}>
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
          />

          <Button
            label="Send Reset Link"
            onPress={handleReset}
            isLoading={isLoading}
            fullWidth
            style={styles.btn}
          />

          <Button
            label="Back to Sign In"
            onPress={() => router.back()}
            variant="ghost"
            size="sm"
            style={styles.btn}
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
    fontSize: 26,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: spacingNumeric.xxs,
  },
  card: {
    width: '100%',
  },
  messageBox: {
    padding: spacingNumeric.sm,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: spacingNumeric.md,
    alignItems: 'center',
  },
  btn: {
    marginTop: spacingNumeric.xs,
  },
});
