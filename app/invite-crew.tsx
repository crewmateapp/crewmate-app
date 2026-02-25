// app/invite-crew.tsx - Invite Crew to join CrewMate alpha testing
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { isAdmin, useAdminRole } from '@/hooks/useAdminRole';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

// ─── Links ────────────────────────────────────────────────────────────────────

const TESTFLIGHT_LINK = 'https://testflight.apple.com/join/AxsKY8He';
const GOOGLE_PLAY_LINK = 'https://play.google.com/apps/internaltest/4701523335266028546';
const ANDROID_SIGNUP_LINK = 'https://crewmateapp.dev/android-signup';
const FEEDBACK_EMAIL = 'hello@crewmateapp.dev';

// ─── Share Messages ───────────────────────────────────────────────────────────

const getShareMessage = (firstName?: string, referralLink?: string) => {
  const name = firstName || 'A fellow crew member';
  const referralLine = referralLink ? `\n🔗 Use my invite link to join: ${referralLink}\n` : '';

  return `Hey! ${name} invited you to test CrewMate — the app built by crew, for crew ✈️

CrewMate helps airline crew connect during layovers, discover crew-recommended spots, and make plans together. We're currently in alpha testing and looking for crew to help shape the app!
${referralLine}
📱 Download & Join:
• iPhone: ${TESTFLIGHT_LINK}
• Android: Sign up here to get access → ${ANDROID_SIGNUP_LINK}

📋 Quick Start:
1. Download and sign up with your airline email
2. Add your profile photo, airline, and base to complete your profile
3. Add a layover (future ones or use GPS when you're there)
4. Explore! Connect with crew, check out spots, or create a plan

✅ Pro tip: Complete your profile (photo + airline + base) so the crew member who invited you gets credit!

🐛 Found a bug or have feedback?
Use the feedback button in the app, or email ${FEEDBACK_EMAIL}

Blue skies! ✈️`;
};

const getShortMessage = (referralLink?: string) => {
  const referralLine = referralLink ? `\n\nJoin with my link: ${referralLink}` : '';

  return `Hey! Come test CrewMate — the app built by crew, for crew ✈️ Connect during layovers, find crew-recommended spots & make plans together.

iPhone: ${TESTFLIGHT_LINK}
Android: ${ANDROID_SIGNUP_LINK}${referralLine}

Make sure to add your photo, airline & base when you sign up! 📸`;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function InviteCrewScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { role } = useAdminRole();
  const [copied, setCopied] = useState(false);

  // Generate referral link for tracking
  const referralLink = user?.uid ? `https://crewmateapp.dev/refer/${user.uid}` : undefined;

  const handleShareFull = async (firstName?: string) => {
    try {
      await Share.share({
        message: getShareMessage(firstName, referralLink),
        title: 'Join me on CrewMate!',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleShareShort = async () => {
    try {
      await Share.share({
        message: getShortMessage(referralLink),
        title: 'Join me on CrewMate!',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleCopyLinks = async () => {
    try {
      const refLine = referralLink ? `\nReferral link: ${referralLink}` : '';
      const text = `CrewMate Alpha Testing\niPhone: ${TESTFLIGHT_LINK}\nAndroid: ${GOOGLE_PLAY_LINK}${refLine}`;
      await Clipboard.setStringAsync(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (error) {
      Alert.alert('Error', 'Could not copy to clipboard');
    }
  };

  const handleEmailInvite = async () => {
    const subject = 'Come test CrewMate with me! ✈️';
    const body = getShareMessage(undefined, referralLink);
    const emailUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    try {
      const canOpen = await Linking.canOpenURL(emailUrl);
      if (canOpen) {
        await Linking.openURL(emailUrl);
      } else {
        Alert.alert('Email Not Available', 'Use the share button instead to send via text or other apps.');
      }
    } catch (error) {
      console.error('Error opening email:', error);
    }
  };

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Invite Crew</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={[styles.heroIcon, { backgroundColor: Colors.primary + '15' }]}>
            <Ionicons name="paper-plane" size={40} color={Colors.primary} />
          </View>
          <ThemedText style={styles.heroTitle}>Help Us Grow the Crew</ThemedText>
          <ThemedText style={[styles.heroSubtitle, { color: colors.text.secondary }]}>
            CrewMate is in alpha testing and every crew member you invite helps us build a better app. Share the love with your flying partners, crashpad crew, and galley besties!
          </ThemedText>
        </View>

        {/* How It Works */}
        <View style={styles.section}>
          <ThemedText style={[styles.sectionLabel, { color: colors.text.secondary }]}>
            HOW IT WORKS
          </ThemedText>

          <View style={[styles.stepCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.stepNumber, { backgroundColor: Colors.primary }]}>
              <ThemedText style={styles.stepNumberText}>1</ThemedText>
            </View>
            <View style={styles.stepContent}>
              <ThemedText style={styles.stepTitle}>You share the invite</ThemedText>
              <ThemedText style={[styles.stepDesc, { color: colors.text.secondary }]}>
                Send via text, AirDrop, email — whatever works. The invite includes download links for both iPhone and Android.
              </ThemedText>
            </View>
          </View>

          <View style={[styles.stepCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.stepNumber, { backgroundColor: Colors.primary }]}>
              <ThemedText style={styles.stepNumberText}>2</ThemedText>
            </View>
            <View style={styles.stepContent}>
              <ThemedText style={styles.stepTitle}>They download & sign up</ThemedText>
              <ThemedText style={[styles.stepDesc, { color: colors.text.secondary }]}>
                iPhone users get it via TestFlight. Android users join through Google Play testing. They sign up with their airline email to verify.
              </ThemedText>
            </View>
          </View>

          <View style={[styles.stepCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.stepNumber, { backgroundColor: Colors.primary }]}>
              <ThemedText style={styles.stepNumberText}>3</ThemedText>
            </View>
            <View style={styles.stepContent}>
              <ThemedText style={styles.stepTitle}>Connect on your next layover</ThemedText>
              <ThemedText style={[styles.stepDesc, { color: colors.text.secondary }]}>
                More crew on CrewMate means more people to meet up with, more spot recommendations, and better layovers for everyone.
              </ThemedText>
            </View>
          </View>
        </View>

        {/* Share Buttons */}
        <View style={styles.section}>
          <ThemedText style={[styles.sectionLabel, { color: colors.text.secondary }]}>
            SHARE THE INVITE
          </ThemedText>

          {/* Primary: Full Share */}
          <TouchableOpacity
            style={[styles.shareButton, { backgroundColor: Colors.primary }]}
            onPress={() => handleShareFull()}
            activeOpacity={0.8}
          >
            <Ionicons name="share-outline" size={22} color={Colors.white} />
            <ThemedText style={styles.shareButtonText}>Share Invite</ThemedText>
          </TouchableOpacity>

          {/* Secondary row */}
          <View style={styles.shareRow}>
            <TouchableOpacity
              style={[styles.shareButtonSecondary, { borderColor: colors.border, backgroundColor: colors.card }]}
              onPress={handleShareShort}
              activeOpacity={0.7}
            >
              <Ionicons name="chatbubble-outline" size={18} color={Colors.primary} />
              <ThemedText style={[styles.shareButtonSecondaryText, { color: Colors.primary }]}>
                Quick Text
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.shareButtonSecondary, { borderColor: colors.border, backgroundColor: colors.card }]}
              onPress={handleEmailInvite}
              activeOpacity={0.7}
            >
              <Ionicons name="mail-outline" size={18} color={Colors.primary} />
              <ThemedText style={[styles.shareButtonSecondaryText, { color: Colors.primary }]}>
                Email
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.shareButtonSecondary, { borderColor: colors.border, backgroundColor: copied ? Colors.primary + '15' : colors.card }]}
              onPress={handleCopyLinks}
              activeOpacity={0.7}
            >
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={18} color={Colors.primary} />
              <ThemedText style={[styles.shareButtonSecondaryText, { color: Colors.primary }]}>
                {copied ? 'Copied!' : 'Copy Links'}
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Download Links Reference */}
        <View style={styles.section}>
          <ThemedText style={[styles.sectionLabel, { color: colors.text.secondary }]}>
            DOWNLOAD LINKS
          </ThemedText>

          <TouchableOpacity
            style={[styles.linkCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => Linking.openURL(TESTFLIGHT_LINK)}
            activeOpacity={0.7}
          >
            <View style={[styles.linkIcon, { backgroundColor: '#007AFF20' }]}>
              <Ionicons name="logo-apple" size={22} color="#007AFF" />
            </View>
            <View style={styles.linkInfo}>
              <ThemedText style={styles.linkTitle}>iPhone (TestFlight)</ThemedText>
              <ThemedText style={[styles.linkUrl, { color: colors.text.secondary }]} numberOfLines={1}>
                {TESTFLIGHT_LINK}
              </ThemedText>
            </View>
            <Ionicons name="open-outline" size={18} color={colors.text.secondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.linkCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => Linking.openURL(GOOGLE_PLAY_LINK)}
            activeOpacity={0.7}
          >
            <View style={[styles.linkIcon, { backgroundColor: '#34A85320' }]}>
              <Ionicons name="logo-google-playstore" size={22} color="#34A853" />
            </View>
            <View style={styles.linkInfo}>
              <ThemedText style={styles.linkTitle}>Android (Google Play)</ThemedText>
              <ThemedText style={[styles.linkUrl, { color: colors.text.secondary }]} numberOfLines={1}>
                Requires email signup first
              </ThemedText>
            </View>
            <Ionicons name="open-outline" size={18} color={colors.text.secondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.linkCard, { backgroundColor: '#34A85308', borderColor: '#34A85330' }]}
            onPress={() => Linking.openURL(ANDROID_SIGNUP_LINK)}
            activeOpacity={0.7}
          >
            <View style={[styles.linkIcon, { backgroundColor: '#34A85320' }]}>
              <Ionicons name="person-add" size={22} color="#34A853" />
            </View>
            <View style={styles.linkInfo}>
              <ThemedText style={styles.linkTitle}>Android Signup Form</ThemedText>
              <ThemedText style={[styles.linkUrl, { color: colors.text.secondary }]} numberOfLines={1}>
                Android users submit their email here
              </ThemedText>
            </View>
            <Ionicons name="open-outline" size={18} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* Admin: Manage Android Testers */}
        {isAdmin(role) && (
          <View style={styles.section}>
            <TouchableOpacity
              style={[styles.adminCard, { backgroundColor: Colors.primary + '08', borderColor: Colors.primary + '30' }]}
              onPress={() => router.push('/android-testers')}
              activeOpacity={0.7}
            >
              <View style={styles.adminCardLeft}>
                <Ionicons name="shield-checkmark" size={22} color={Colors.primary} />
                <View>
                  <ThemedText style={[styles.adminCardTitle, { color: Colors.primary }]}>
                    Manage Android Requests
                  </ThemedText>
                  <ThemedText style={[styles.adminCardDesc, { color: colors.text.secondary }]}>
                    View signups, copy emails, mark as added
                  </ThemedText>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Beta Tester Community */}
        <View style={styles.section}>
          <View style={[styles.communityCard, { backgroundColor: Colors.accent + '10', borderColor: Colors.accent + '30' }]}>
            <View style={styles.communityHeader}>
              <Ionicons name="people" size={22} color={Colors.accent} />
              <ThemedText style={[styles.communityTitle, { color: Colors.accent }]}>
                Beta Tester Community
              </ThemedText>
            </View>
            <ThemedText style={[styles.communityDesc, { color: colors.text.secondary }]}>
              We have a private Facebook group for alpha testers where we share updates, discuss features, and answer questions quickly. Ask Zach to be added!
            </ThemedText>
            <TouchableOpacity
              style={[styles.communityButton, { borderColor: Colors.accent }]}
              onPress={() => {
                const subject = 'Add me to the CrewMate Beta Testers FB Group';
                const body = `Hi Zach!\n\nI'd like to be added to the CrewMate beta tester Facebook group.\n\nMy Facebook name: [your name on FB]\n\nThanks!`;
                const emailUrl = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                Linking.openURL(emailUrl);
              }}
            >
              <Ionicons name="mail-outline" size={16} color={Colors.accent} />
              <ThemedText style={[styles.communityButtonText, { color: Colors.accent }]}>
                Request to Join Group
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer note */}
        <View style={styles.footerSection}>
          <ThemedText style={[styles.footerText, { color: colors.text.secondary }]}>
            CrewMate is completely free during alpha testing. Every crew member you invite helps us build something amazing for the crew community. Thank you for being part of this! ✈️
          </ThemedText>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </ThemedView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  // ─── Hero ─────────────────────────────────────────────
  heroSection: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 32,
    paddingBottom: 24,
  },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  // ─── Sections ─────────────────────────────────────────
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  // ─── Steps ────────────────────────────────────────────
  stepCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    gap: 14,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  stepDesc: {
    fontSize: 13,
    lineHeight: 19,
  },
  // ─── Share Buttons ────────────────────────────────────
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: 12,
  },
  shareButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  shareRow: {
    flexDirection: 'row',
    gap: 10,
  },
  shareButtonSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  shareButtonSecondaryText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // ─── Link Cards ───────────────────────────────────────
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    gap: 12,
  },
  linkIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkInfo: {
    flex: 1,
  },
  linkTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  linkUrl: {
    fontSize: 12,
  },
  // ─── Admin Card ─────────────────────────────────────────
  adminCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  adminCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  adminCardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  adminCardDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  // ─── Community Card ───────────────────────────────────
  communityCard: {
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
  },
  communityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  communityTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  communityDesc: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  communityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  communityButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // ─── Footer ───────────────────────────────────────────
  footerSection: {
    paddingHorizontal: 32,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
