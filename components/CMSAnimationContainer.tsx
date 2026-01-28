// components/CMSAnimationContainer.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { CMSAnimation } from './CMSAnimation';
import { CMSToast } from './CMSToast';
import { LevelUpModal } from './LevelUpModal';
import { BadgeUnlockedModal } from './BadgeUnlockedModal';
import { useCMSTracking } from '@/hooks/useCMSTracking';

interface CMSAnimationContainerProps {
  tracking: ReturnType<typeof useCMSTracking>;
}

/**
 * Container component that renders all CMS-related animations and modals
 * Handles floating animations, toasts, level-ups, and badge unlocks
 */
export function CMSAnimationContainer({ tracking }: CMSAnimationContainerProps) {
  const {
    floatingAnimation,
    toastQueue,
    levelUpData,
    badgeUnlocked,
    clearFloatingAnimation,
    dismissToast,
    closeLevelUp,
    closeBadgeUnlock,
  } = tracking;

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Floating "+X CMS" Animation */}
      {floatingAnimation && (
        <CMSAnimation
          amount={floatingAnimation.amount}
          onComplete={clearFloatingAnimation}
          startPosition={floatingAnimation.position}
        />
      )}

      {/* Toast Notifications Queue */}
      {toastQueue.map((toast) => (
        <CMSToast
          key={toast.id}
          toast={toast}
          onDismiss={dismissToast}
        />
      ))}

      {/* Level-Up Modal */}
      {levelUpData && (
        <LevelUpModal
          visible={true}
          oldLevel={levelUpData.oldLevel}
          newLevel={levelUpData.newLevel}
          onClose={closeLevelUp}
        />
      )}

      {/* Badge Unlock Modal */}
      {badgeUnlocked && (
        <BadgeUnlockedModal
          visible={true}
          badge={badgeUnlocked}
          onClose={closeBadgeUnlock}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
});
