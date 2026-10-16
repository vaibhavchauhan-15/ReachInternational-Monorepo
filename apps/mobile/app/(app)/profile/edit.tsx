import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../lib/auth/useAuth';
import { useTheme, MobileHeader } from '../../../components/ui';
import { ProfileEditForm } from '../../../components/profile/ProfileEditForm';
import { supabase } from '../../../lib/supabase';
import { fetchUserDocuments, type UserDocumentInfo } from '../../../lib/documents';

export default function ProfileEditScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { user, userProfile } = useAuth();

  const [existingDocuments, setExistingDocuments] = useState<UserDocumentInfo[]>([]);
  const [pendingRequest, setPendingRequest] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const targetUserId = userProfile?.id || user?.id;

  const loadData = useCallback(async () => {
    if (!targetUserId) return;
    try {
      const [docs, { data: req }] = await Promise.all([
        fetchUserDocuments(targetUserId),
        supabase
          .from('profile_change_requests')
          .select('*')
          .eq('user_id', targetUserId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .maybeSingle(),
      ]);

      setExistingDocuments(docs || []);
      setPendingRequest(req || null);
    } catch (err) {
      console.warn('Error loading profile edit metadata:', err);
    } finally {
      setLoading(false);
    }
  }, [targetUserId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/profile' as any);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      <MobileHeader
        title="Edit Profile"
        subtitle="Update personal details, banking, and statutory documents"
        showBack={true}
        onPressBack={handleBack}
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.link} />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.content}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ProfileEditForm
            currentUser={userProfile || user}
            existingDocuments={existingDocuments}
            pendingRequest={pendingRequest}
            isModal={false}
            onCancel={handleBack}
            onSuccess={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/profile' as any);
              }
            }}
          />
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
