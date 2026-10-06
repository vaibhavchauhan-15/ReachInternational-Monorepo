import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';
import { FONT_SCALE_PRESETS, OS_FONT_SCALE_CAP, type FontScalePreset } from '@reachinternational/design-tokens';

const KEY = '@reach:font_size_preference';

type Ctx = { preset: FontScalePreset; scale: number; ready: boolean; setPreset: (p: FontScalePreset) => void };
const TypeScaleContext = createContext<Ctx>({ preset: 'medium', scale: 1, ready: false, setPreset: () => {} });

export function TypeScaleProvider({ children }: { children: ReactNode }) {
  const { fontScale: os = 1 } = useWindowDimensions();
  const [preset, setPresetState] = useState<FontScalePreset>('medium');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v) {
          if (v in FONT_SCALE_PRESETS) {
            setPresetState(v as FontScalePreset);
          } else if (v === 'default') {
            setPresetState('medium');
          }
        }
      })
      .finally(() => setReady(true));
  }, []);

  const setPreset = useCallback((p: FontScalePreset) => {
    setPresetState(p);
    AsyncStorage.setItem(KEY, p).catch(() => {});
  }, []);

  const value = useMemo(
    () => ({ preset, ready, setPreset, scale: FONT_SCALE_PRESETS[preset] * Math.min(os || 1, OS_FONT_SCALE_CAP) }),
    [preset, ready, setPreset, os],
  );
  return <TypeScaleContext.Provider value={value}>{children}</TypeScaleContext.Provider>;
}

export const useTypeScale = () => useContext(TypeScaleContext);
