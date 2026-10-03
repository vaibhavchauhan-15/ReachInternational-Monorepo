import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';

export default function SettingCatchAllRedirect() {
  const { slug } = useLocalSearchParams();
  const router = useRouter();

  useEffect(() => {
    const raw = Array.isArray(slug) ? slug.join('/') : slug || '';
    if (!raw) {
      router.replace('/(app)/settings');
      return;
    }
    if (raw === 'prefrence' || raw === 'preference') {
      router.replace('/(app)/settings/preference');
      return;
    }
    if (raw === 'aboutapp' || raw === 'about-app') {
      router.replace('/(app)/settings/aboutapp');
      return;
    }
    router.replace(`/(app)/settings/${raw}` as any);
  }, [slug, router]);

  return null;
}
