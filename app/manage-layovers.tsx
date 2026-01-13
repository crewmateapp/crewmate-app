// app/manage-layovers.tsx
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { doc, getDoc, updateDoc, arrayRemove } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

type UpcomingLayover = {
  id: string;
  city: string;
  area: string;
  startDate: any; // Firestore Timestamp or Date
  endDate: any;
  status: 'upcoming' | 'active' | 'past';
  preDiscoverable?: boolean;
  createdAt: any;
};

export default function ManageLayoversScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [upcomingLayovers, setUpcomingLayovers] = useState<UpcomingLayover[]>([]);

  useEffect(() => {
    fetchLayovers();
  }, [user]);

  const fetchLayovers = async () => {
    if (!user?.uid) return;

    setLoading(true);
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        const layovers = data.upcomingLayovers || [];
        
        // Sort by start date (earliest first)
        const sorted = layovers.sort((a: UpcomingLayover, b: UpcomingLayover) => {
          const aDate = a.startDate?.toDate ? a.startDate.toDate() : new Date(a.startDate);
          const bDate = b.startDate?.toDate ? b.startDate.toDate() : new Date(b.startDate);
          return aDate.getTime() - bDate.getTime();
        });
        
        setUpcomingLayovers(sorted);
      }
    } catch (error) {
      console.error('Error fetching layovers:', error);
      Alert.alert('Error', 'Failed to load layovers');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (layover: UpcomingLayover) => {
    Alert.alert(
      'Delete Layover',
      `Are you sure you want to delete your ${layover.city} layover?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'users', user!.uid), {
                upcomingLayovers: arrayRemove(layover),
              });
              
              // Update local state
              setUpcomingLayovers(prev => prev.filter(l => l.id !== layover.id));
              
              Alert.alert('Deleted', 'Layover has been removed');
            } catch (error) {
              console.error('Error deleting layover:', error);
              Alert.alert('Error', 'Failed to delete layover');
            }
          },
        },
      ]
    );
  };

  const formatDate = (date: any) => {
    const d = date?.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateRange = (startDate: any, endDate: any) => {
    const start = startDate?.toDate ? startDate.toDate() : new Date(startDate);
    const end = endDate?.toDate ? endDate.toDate() : new Date(endDate);
    
    // If same day
    if (start.toDateString() === end.toDateString()) {
      return formatDate(startDate);
    }
    
    // Different days
    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  };

  const getDaysUntil = (startDate: any) => {
    const date = startDate?.toDate ? startDate.toDate() : new Date(startDate);
    const now = new Date();
    const diff = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff < 0) return 'Past';
    return `${diff} days`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="chevron-back" size={28} color={Colors.primary} />
            </TouchableOpacity>
            <ThemedText style={styles.headerTitle}>Manage Layovers</ThemedText>
            <View style={{ width: 28 }} />
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        </ThemedView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={28} color={Colors.primary} />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Manage Layovers</ThemedText>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView style={styles.content}>
          {upcomingLayovers.length > 0 ? (
            <>
              <ThemedText style={styles.subtitle}>
                {upcomingLayovers.length} upcoming {upcomingLayovers.length === 1 ? 'layover' : 'layovers'}
              </ThemedText>

              {upcomingLayovers.map((layover) => (
                <View key={layover.id} style={styles.layoverCard}>
                  <View style={styles.layoverHeader}>
                    <View style={styles.layoverInfo}>
                      <View style={styles.cityRow}>
                        <Ionicons name="airplane" size={20} color={Colors.primary} />
                        <ThemedText style={styles.cityText}>{layover.city}</ThemedText>
                      </View>
                      <ThemedText style={styles.areaText}>{layover.area}</ThemedText>
                      <ThemedText style={styles.dateText}>
                        {formatDateRange(layover.startDate, layover.endDate)}
                      </ThemedText>
                    </View>
                    
                    <View style={styles.daysUntilBadge}>
                      <ThemedText style={styles.daysUntilText}>
                        {getDaysUntil(layover.startDate)}
                      </ThemedText>
                    </View>
                  </View>

                  {/* Actions */}
                  <View style={styles.actionsRow}>
                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={() => router.push(`/explore?city=${layover.city}&layoverId=${layover.id}`)}
                    >
                      <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
                      <ThemedText style={styles.actionButtonText}>Add Plan</ThemedText>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.deleteButton]}
                      onPress={() => handleDelete(layover)}
                    >
                      <Ionicons name="trash-outline" size={18} color={Colors.error} />
                      <ThemedText style={[styles.actionButtonText, styles.deleteButtonText]}>
                        Delete
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={80} color={Colors.text.secondary} />
              <ThemedText style={styles.emptyTitle}>No Upcoming Layovers</ThemedText>
              <ThemedText style={styles.emptyText}>
                Add your upcoming layovers to start planning ahead
              </ThemedText>
            </View>
          )}
        </ScrollView>

        {/* Add Layover Button */}
        <View style={styles.footer}>
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => router.push('/add-layover')}
          >
            <Ionicons name="add-circle" size={24} color={Colors.white} />
            <ThemedText style={styles.addButtonText}>Add Layover</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.text.secondary,
    marginBottom: 20,
  },
  layoverCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  layoverHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  layoverInfo: {
    flex: 1,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  cityText: {
    fontSize: 20,
    fontWeight: '700',
  },
  areaText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  dateText: {
    fontSize: 15,
    color: Colors.text.secondary,
  },
  daysUntilBadge: {
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  daysUntilText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  deleteButton: {
    borderColor: Colors.error + '40',
  },
  deleteButtonText: {
    color: Colors.error,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    padding: 20,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  addButtonText: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
});
