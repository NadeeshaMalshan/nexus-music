import { type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EchoBackground } from '@/src/components/echoai/EchoBackground';

export function ScreenChrome({ children }: { children: ReactNode }) {
  return (
    <EchoBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        {children}
      </SafeAreaView>
    </EchoBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
