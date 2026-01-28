// app/cms-info.tsx - How to Earn CMS & Current Progress
import AppHeader from '@/components/AppHeader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/Colors';
import { CMS_POINTS } from '@/constants/ScoringRules';
import { getCMSNeededForNextLevel, getLevelColor, getLevelForCMS, getNextLevel, getProgressToNextLevel } from '@/constants/Levels';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import { db } from '@/config/firebase';

export default function CMSInfoScreen() {
  const { user } = useAuth();
  const [userCMS, setUserCMS] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserCMS = async () => {
      if (!user?.uid) return;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserCMS(data.cms || 0);
        }
      } catch (error) {
        console.error('Error fetching CMS:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserCMS();
  }, [user]);

  const currentLevel = getLevelForCMS(userCMS);
  const nextLevel = getNextLevel(userCMS);
  const progress = getProgressToNextLevel(userCMS);
  const cmsNeeded = getCMSNeededForNextLevel(userCMS);

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

        {/* Current Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Ionicons name="trophy" size={32} color={getLevelColor(userCMS)} />
            <ThemedText style={styles.statusTitle}>Your CrewMate Score</ThemedText>
          </View>

          <ThemedText style={[styles.cmsScore, { color: getLevelColor(userCMS) }]}>
            {userCMS} CMS
          </ThemedText>

          <View style={styles.levelBadge}>
            <Ionicons name={currentLevel.icon} size={20} color={currentLevel.color} />
            <ThemedText style={[styles.levelName, { color: currentLevel.color }]}>
              {currentLevel.name}
            </ThemedText>
          </View>

          {nextLevel && (
            <>
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { 
                        width: `${progress * 100}%`,
                        backgroundColor: currentLevel.color 
                      }
                    ]} 
                  />
                </View>
                <ThemedText style={styles.progressText}>
                  {cmsNeeded} CMS until {nextLevel.name}
                </ThemedText>
              </View>

              <View style={styles.nextLevelPreview}>
                <ThemedText style={styles.nextLevelLabel}>Next Level Benefits:</ThemedText>
                {nextLevel.benefits.slice(0, 3).map((benefit, index) => (
                  <View key={index} style={styles.benefitRow}>
                    <Ionicons name="checkmark-circle" size={16} color={nextLevel.color} />
                    <ThemedText style={styles.benefitText}>{benefit}</ThemedText>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>

        {/* How to Earn CMS */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>How to Earn CMS</ThemedText>

          {/* Check-ins & Activity */}
          <View style={styles.category}>
            <View style={styles.categoryHeader}>
              <Ionicons name="location" size={24} color={Colors.primary} />
              <ThemedText style={styles.categoryTitle}>Check-ins & Activity</ThemedText>
            </View>
            
            <ActionRow icon="pin" label="Check into layover" points={CMS_POINTS.LAYOVER_CHECK_IN} />
            <ActionRow icon="time" label="Stay 12+ hours" points={CMS_POINTS.LAYOVER_12_HOUR_BONUS} bonus />
            <ActionRow icon="checkmark-circle" label="Complete 24-hour layover" points={CMS_POINTS.LAYOVER_24_HOUR_COMPLETE} bonus />
            <ActionRow icon="business" label="Check into spot" points={CMS_POINTS.SPOT_CHECK_IN} />
          </View>

          {/* Plans & Social */}
          <View style={styles.category}>
            <View style={styles.categoryHeader}>
              <Ionicons name="calendar" size={24} color={Colors.primary} />
              <ThemedText style={styles.categoryTitle}>Plans & Social</ThemedText>
            </View>
            
            <ActionRow icon="add-circle" label="Host a plan" points={CMS_POINTS.HOST_PLAN} />
            <ActionRow icon="people" label="Join a plan" points={CMS_POINTS.JOIN_PLAN} />
            <ActionRow icon="star" label="Plan gets 5+ attendees" points={CMS_POINTS.PLAN_5_PLUS_ATTENDEES} bonus hostOnly />
            <ActionRow icon="checkmark-done" label="Attend plan (verified)" points={CMS_POINTS.ATTEND_PLAN_VERIFIED} />
            <ActionRow icon="heart" label="Your plan rated 5 stars" points={CMS_POINTS.PLAN_RATED_5_STARS} bonus hostOnly />
          </View>

          {/* Reviews & Content */}
          <View style={styles.category}>
            <View style={styles.categoryHeader}>
              <Ionicons name="star-half" size={24} color={Colors.primary} />
              <ThemedText style={styles.categoryTitle}>Reviews & Content</ThemedText>
            </View>
            
            <ActionRow icon="create" label="Write spot review" points={CMS_POINTS.WRITE_REVIEW} />
            <ActionRow icon="thumbs-up" label="Review upvoted" points={CMS_POINTS.REVIEW_UPVOTE} perAction="per upvote" />
            <ActionRow icon="camera" label="Add spot photo" points={CMS_POINTS.ADD_SPOT_PHOTO} />
            <ActionRow icon="image" label="Photo featured" points={CMS_POINTS.PHOTO_FEATURED} bonus />
            <ActionRow icon="ribbon" label="First review of spot" points={CMS_POINTS.FIRST_REVIEW_OF_SPOT} bonus />
            <ActionRow icon="document-text" label="Review over 100 words" points={CMS_POINTS.REVIEW_OVER_100_WORDS} bonus />
          </View>

          {/* Community Building */}
          <View style={styles.category}>
            <View style={styles.categoryHeader}>
              <Ionicons name="people-circle" size={24} color={Colors.primary} />
              <ThemedText style={styles.categoryTitle}>Community Building</ThemedText>
            </View>
            
            <ActionRow icon="person-add" label="Accept connection" points={CMS_POINTS.ACCEPT_CONNECTION} />
            <ActionRow icon="chatbubble" label="Send first message to crew" points={CMS_POINTS.SEND_FIRST_MESSAGE} />
            <ActionRow icon="hand-left" label="Welcome new crew member" points={CMS_POINTS.WELCOME_NEW_CREW} />
            <ActionRow icon="shield-checkmark" label="Verify crew's layover" points={CMS_POINTS.VERIFY_LAYOVER} />
          </View>

          {/* Special Bonuses */}
          <View style={styles.category}>
            <View style={styles.categoryHeader}>
              <Ionicons name="flash" size={24} color={Colors.accent} />
              <ThemedText style={styles.categoryTitle}>Special Bonuses</ThemedText>
            </View>
            
            <ActionRow icon="calendar-outline" label="Active all week" points={CMS_POINTS.WEEKLY_ACTIVE_BONUS} bonus perAction="once per week" />
            <ActionRow icon="flag" label="Report confirmed bad content" points={CMS_POINTS.REPORT_BAD_CONTENT} bonus />
            <ActionRow icon="medal" label="Earn new badge" points={0} custom="Badge CMS varies" />
          </View>
        </View>

        {/* Pro Tips */}
        <View style={styles.tipsCard}>
          <View style={styles.tipsHeader}>
            <Ionicons name="bulb" size={24} color={Colors.accent} />
            <ThemedText style={styles.tipsTitle}>Pro Tips</ThemedText>
          </View>
          
          <View style={styles.tipItem}>
            <ThemedText style={styles.tipText}>
              💡 Host plans with 5+ attendees for big bonus CMS
            </ThemedText>
          </View>
          <View style={styles.tipItem}>
            <ThemedText style={styles.tipText}>
              💡 Write detailed reviews (100+ words) for extra points
            </ThemedText>
          </View>
          <View style={styles.tipItem}>
            <ThemedText style={styles.tipText}>
              💡 Be first to review a spot for +25 bonus CMS
            </ThemedText>
          </View>
          <View style={styles.tipItem}>
            <ThemedText style={styles.tipText}>
              💡 Stay active all week for +50 CMS bonus
            </ThemedText>
          </View>
          <View style={styles.tipItem}>
            <ThemedText style={styles.tipText}>
              💡 Welcome new crew members to build community
            </ThemedText>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

// Helper component for action rows
function ActionRow({ 
  icon, 
  label, 
  points, 
  bonus, 
  hostOnly, 
  perAction, 
  custom 
}: { 
  icon: string;
  label: string;
  points: number;
  bonus?: boolean;
  hostOnly?: boolean;
  perAction?: string;
  custom?: string;
}) {
  return (
    <View style={styles.actionRow}>
      <View style={styles.actionLeft}>
        <Ionicons name={icon as any} size={20} color={Colors.text.secondary} />
        <View style={styles.actionTextContainer}>
          <ThemedText style={styles.actionLabel}>{label}</ThemedText>
          {hostOnly && (
            <ThemedText style={styles.actionSubtext}>(Host only)</ThemedText>
          )}
          {perAction && (
            <ThemedText style={styles.actionSubtext}>({perAction})</ThemedText>
          )}
        </View>
      </View>
      <View style={styles.actionRight}>
        {custom ? (
          <ThemedText style={styles.actionCustom}>{custom}</ThemedText>
        ) : (
          <>
            <ThemedText style={[styles.actionPoints, bonus && styles.actionBonus]}>
              +{points}
            </ThemedText>
            {bonus && (
              <View style={styles.bonusBadge}>
                <ThemedText style={styles.bonusText}>BONUS</ThemedText>
              </View>
            )}
          </>
        )}
      </View>
    </View>
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
  statusCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  cmsScore: {
    fontSize: 48,
    fontWeight: '700',
    marginBottom: 12,
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.background,
    borderRadius: 20,
    marginBottom: 24,
  },
  levelName: {
    fontSize: 16,
    fontWeight: '600',
  },
  progressContainer: {
    width: '100%',
    marginBottom: 20,
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  nextLevelPreview: {
    width: '100%',
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
  },
  nextLevelLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 12,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  benefitText: {
    fontSize: 14,
    color: Colors.text.secondary,
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 20,
  },
  category: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionLabel: {
    fontSize: 15,
    color: Colors.text.primary,
  },
  actionSubtext: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  actionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionPoints: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  actionBonus: {
    color: Colors.accent,
  },
  actionCustom: {
    fontSize: 13,
    color: Colors.text.secondary,
    fontStyle: 'italic',
  },
  bonusBadge: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bonusText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.white,
  },
  tipsCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.accent + '30',
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  tipsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  tipItem: {
    paddingVertical: 8,
  },
  tipText: {
    fontSize: 15,
    color: Colors.text.primary,
    lineHeight: 22,
  },
});
