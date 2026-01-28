// app/plan-invite.tsx
import AppHeader from '@/components/AppHeader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

export default function PlanInviteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [planTitle, setPlanTitle] = useState('');
  const [shareUrl, setShareUrl] = useState('');

  useEffect(() => {
    if (!id) return;

    // Fetch plan details
    const fetchPlan = async () => {
      try {
        const planDoc = await getDoc(doc(db, 'plans', id));
        if (planDoc.exists()) {
          const data = planDoc.data();
          setPlanTitle(data.title || 'CrewMate Plan');
          
          // Generate share URL
          // For now using custom scheme - we'll add universal links later
          const url = `crewmateapp://plan/${id}`;
          setShareUrl(url);
        }
      } catch (error) {
        console.error('Error fetching plan:', error);
        Alert.alert('Error', 'Failed to load plan details');
      } finally {
        setLoading(false);
      }
    };

    fetchPlan();
  }, [id]);

  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(shareUrl);
    Alert.alert('Link Copied!', 'Share link copied to clipboard');
  };

  const handleShare = async () => {
    try {
      const shareMessage = `Join me at ${planTitle} on CrewMate! 🛫\n\nTap this link to RSVP:\n${shareUrl}`;
      
      const result = await Share.share({
        message: shareMessage,
        title: `Join ${planTitle} on CrewMate`,
        url: shareUrl, // iOS only - adds URL separately
      });

      if (result.action === Share.sharedAction) {
        console.log('✅ Plan shared successfully');
      } else if (result.action === Share.dismissedAction) {
        console.log('❌ Share dismissed');
      }
    } catch (error) {
      console.error('Error sharing:', error);
      // Fallback to copy
      handleCopyLink();
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader onMenuPress={() => router.back()} />
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 100 }} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={() => router.back()} />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.primary} />
            <ThemedText style={styles.backText}>Back</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Main Content */}
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons name="people" size={48} color={Colors.primary} />
          </View>
          
          <ThemedText style={styles.title}>Invite Crew to Your Plan</ThemedText>
          <ThemedText style={styles.subtitle}>{planTitle}</ThemedText>

          {/* QR Code */}
          <View style={styles.qrContainer}>
            <View style={styles.qrCodeWrapper}>
              <QRCode
                value={shareUrl}
                size={240}
                backgroundColor="white"
                color={Colors.primary}
                logo={require('@/assets/images/icon.png')}
                logoSize={50}
                logoBackgroundColor="white"
                logoBorderRadius={8}
              />
            </View>
            <ThemedText style={styles.qrInstructions}>
              Have crew scan this code to join your plan
            </ThemedText>
          </View>

          {/* Share Buttons */}
          <View style={styles.buttonsContainer}>
            <TouchableOpacity 
              style={styles.primaryButton}
              onPress={handleShare}
            >
              <Ionicons name="share-social" size={20} color={Colors.white} />
              <ThemedText style={styles.primaryButtonText}>Share Link</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.secondaryButton}
              onPress={handleCopyLink}
            >
              <Ionicons name="copy" size={20} color={Colors.primary} />
              <ThemedText style={styles.secondaryButtonText}>Copy Link</ThemedText>
            </TouchableOpacity>
          </View>

          {/* Share URL Display */}
          <View style={styles.urlContainer}>
            <ThemedText style={styles.urlLabel}>Share URL</ThemedText>
            <View style={styles.urlBox}>
              <ThemedText style={styles.urlText} numberOfLines={1}>
                {shareUrl}
              </ThemedText>
            </View>
          </View>

          {/* Info Box */}
          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={20} color={Colors.info} />
            <ThemedText style={styles.infoText}>
              Only crew members with verified airline emails can join plans. 
              If they don't have CrewMate yet, they'll be prompted to download it.
            </ThemedText>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: 20,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  qrCodeWrapper: {
    padding: 20,
    backgroundColor: Colors.white,
    borderRadius: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  qrInstructions: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  buttonsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.background,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  urlContainer: {
    marginBottom: 24,
  },
  urlLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  urlBox: {
    backgroundColor: Colors.card,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  urlText: {
    fontSize: 14,
    color: Colors.text.secondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  infoBox: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: Colors.info + '15',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.info + '30',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
});
