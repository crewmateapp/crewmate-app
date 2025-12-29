import ActivityFeed from '@/components/activity-feed';
import CrewfiesFeed from '@/components/crewfies-feed';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
    Pressable,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';

type FeedTab = 'activity' | 'crewfies';

export default function FeedScreen() {
  const [activeTab, setActiveTab] = useState<FeedTab>('activity');

  return (
    <ThemedView style={styles.container}>
      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <Pressable
          style={[styles.tab, activeTab === 'activity' && styles.tabActive]}
          onPress={() => setActiveTab('activity')}
        >
          <Ionicons 
            name="pulse" 
            size={20} 
            color={activeTab === 'activity' ? Colors.white : Colors.text.primary} 
          />
          <ThemedText style={[styles.tabText, activeTab === 'activity' && styles.tabTextActive]}>
            Activity
          </ThemedText>
        </Pressable>

        <Pressable
          style={[styles.tab, activeTab === 'crewfies' && styles.tabActive]}
          onPress={() => setActiveTab('crewfies')}
        >
          <Ionicons 
            name="camera" 
            size={20} 
            color={activeTab === 'crewfies' ? Colors.white : Colors.text.primary} 
          />
          <ThemedText style={[styles.tabText, activeTab === 'crewfies' && styles.tabTextActive]}>
            Crewfies
          </ThemedText>
        </Pressable>
      </View>

      {/* Create Post Button (only show on Crewfies tab) */}
      {activeTab === 'crewfies' && (
        <TouchableOpacity 
          style={styles.createButton}
          onPress={() => router.push('/create-post')}
        >
          <Ionicons name="add-circle" size={24} color={Colors.white} />
          <ThemedText style={styles.createButtonText}>Create Crewfie</ThemedText>
        </TouchableOpacity>
      )}

      {/* Feed Content */}
      {activeTab === 'activity' ? <ActivityFeed /> : <CrewfiesFeed />}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Colors.background,
  },
  tabActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  tabTextActive: {
    color: Colors.white,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 12,
    paddingVertical: 12,
    borderRadius: 12,
  },
  createButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});