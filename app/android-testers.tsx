// app/android-testers.tsx - Manage Android beta tester requests
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { isAdmin, useAdminRole } from '@/hooks/useAdminRole';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

type AndroidTester = {
  id: string;
  name: string;
  email: string;
  airlineEmail: string;
  airline: string;
  status: 'pending' | 'added' | 'rejected';
  submittedAt: any;
};

export default function AndroidTestersScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { role } = useAdminRole();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [testers, setTesters] = useState<AndroidTester[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (user && isAdmin(role)) {
      fetchTesters();
    }
  }, [user, role]);

  const fetchTesters = async () => {
    try {
      const q = query(
        collection(db, 'androidTesters'),
        orderBy('submittedAt', 'desc')
      );
      const snap = await getDocs(q);
      const data: AndroidTester[] = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
      } as AndroidTester));
      setTesters(data);
    } catch (error) {
      console.error('Error fetching android testers:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTesters();
    setRefreshing(false);
  };

  const handleCopyEmail = async (email: string, id: string) => {
    await Clipboard.setStringAsync(email);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAllPending = async () => {
    const pendingEmails = testers
      .filter(t => t.status === 'pending')
      .map(t => t.email)
      .join('\n');

    if (!pendingEmails) {
      Alert.alert('No Pending', 'No pending tester emails to copy.');
      return;
    }

    await Clipboard.setStringAsync(pendingEmails);
    Alert.alert('Copied!', `${testers.filter(t => t.status === 'pending').length} pending email(s) copied to clipboard.`);
  };

  const handleMarkAdded = async (tester: AndroidTester) => {
    try {
      await updateDoc(doc(db, 'androidTesters', tester.id), {
        status: 'added',
      });
      setTesters(prev =>
        prev.map(t => t.id === tester.id ? { ...t, status: 'added' } : t)
      );
    } catch (error) {
      console.error('Error updating tester:', error);
      Alert.alert('Error', 'Failed to update status.');
    }
  };

  const handleDelete = (tester: AndroidTester) => {
    Alert.alert(
      'Remove Request',
      `Remove ${tester.name}'s request?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'androidTesters', tester.id));
              setTesters(prev => prev.filter(t => t.id !== tester.id));
            } catch (error) {
              console.error('Error deleting tester:', error);
            }
          },
        },
      ]
    );
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const pendingCount = testers.filter(t => t.status === 'pending').length;
  const addedCount = testers.filter(t => t.status === 'added').length;

  // Auth guard
  if (!isAdmin(role)) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Android Testers</ThemedText>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="lock-closed" size={48} color={colors.text.secondary} />
          <ThemedText style={[styles.emptyText, { color: colors.text.secondary }]}>
            Admin access required
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Android Testers</ThemedText>
          <View style={{ width: 24 }} />
        </View>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 100 }} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Android Testers</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Stats Bar */}
        <View style={styles.statsBar}>
          <View style={[styles.statPill, { backgroundColor: Colors.accent + '15' }]}>
            <ThemedText style={[styles.statPillText, { color: Colors.accent }]}>
              {pendingCount} pending
            </ThemedText>
          </View>
          <View style={[styles.statPill, { backgroundColor: '#34C75915' }]}>
            <ThemedText style={[styles.statPillText, { color: '#34C759' }]}>
              {addedCount} added
            </ThemedText>
          </View>
          <View style={[styles.statPill, { backgroundColor: Colors.primary + '15' }]}>
            <ThemedText style={[styles.statPillText, { color: Colors.primary }]}>
              {testers.length} total
            </ThemedText>
          </View>
        </View>

        {/* Bulk Action */}
        {pendingCount > 0 && (
          <TouchableOpacity
            style={[styles.bulkButton, { backgroundColor: Colors.primary }]}
            onPress={handleCopyAllPending}
            activeOpacity={0.8}
          >
            <Ionicons name="copy" size={18} color={Colors.white} />
            <ThemedText style={styles.bulkButtonText}>
              Copy All Pending Emails ({pendingCount})
            </ThemedText>
          </TouchableOpacity>
        )}

        {/* Tester List */}
        {testers.length > 0 ? (
          testers.map(tester => (
            <View
              key={tester.id}
              style={[styles.testerCard, {
                backgroundColor: colors.card,
                borderColor: tester.status === 'pending' ? Colors.accent + '50' : colors.border,
              }]}
            >
              {/* Status Badge */}
              <View style={styles.testerHeader}>
                <View style={styles.testerNameRow}>
                  <ThemedText style={styles.testerName}>{tester.name}</ThemedText>
                  <View style={[
                    styles.statusBadge,
                    {
                      backgroundColor: tester.status === 'pending'
                        ? Colors.accent + '15'
                        : tester.status === 'added'
                          ? '#34C75915'
                          : colors.text.secondary + '15',
                    }
                  ]}>
                    <ThemedText style={[
                      styles.statusText,
                      {
                        color: tester.status === 'pending'
                          ? Colors.accent
                          : tester.status === 'added'
                            ? '#34C759'
                            : colors.text.secondary,
                      }
                    ]}>
                      {tester.status === 'pending' ? 'Pending' : tester.status === 'added' ? 'Added' : 'Rejected'}
                    </ThemedText>
                  </View>
                </View>
                <ThemedText style={[styles.testerAirline, { color: colors.text.secondary }]}>
                  {tester.airline}
                </ThemedText>
              </View>

              {/* Emails */}
              <View style={styles.emailSection}>
                <TouchableOpacity
                  style={[styles.emailRow, { backgroundColor: colors.background }]}
                  onPress={() => handleCopyEmail(tester.email, tester.id + '-gp')}
                  activeOpacity={0.7}
                >
                  <View style={styles.emailInfo}>
                    <ThemedText style={[styles.emailLabel, { color: colors.text.secondary }]}>Google Play</ThemedText>
                    <ThemedText style={styles.emailText}>{tester.email}</ThemedText>
                  </View>
                  <Ionicons
                    name={copiedId === tester.id + '-gp' ? 'checkmark' : 'copy-outline'}
                    size={18}
                    color={copiedId === tester.id + '-gp' ? '#34C759' : colors.text.secondary}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.emailRow, { backgroundColor: colors.background }]}
                  onPress={() => handleCopyEmail(tester.airlineEmail, tester.id + '-al')}
                  activeOpacity={0.7}
                >
                  <View style={styles.emailInfo}>
                    <ThemedText style={[styles.emailLabel, { color: colors.text.secondary }]}>Airline Email</ThemedText>
                    <ThemedText style={styles.emailText}>{tester.airlineEmail}</ThemedText>
                  </View>
                  <Ionicons
                    name={copiedId === tester.id + '-al' ? 'checkmark' : 'copy-outline'}
                    size={18}
                    color={copiedId === tester.id + '-al' ? '#34C759' : colors.text.secondary}
                  />
                </TouchableOpacity>
              </View>

              {/* Date */}
              <ThemedText style={[styles.testerDate, { color: colors.text.secondary }]}>
                {formatDate(tester.submittedAt)}
              </ThemedText>

              {/* Actions */}
              <View style={styles.testerActions}>
                {tester.status === 'pending' && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#34C759' }]}
                    onPress={() => handleMarkAdded(tester)}
                  >
                    <Ionicons name="checkmark" size={16} color={Colors.white} />
                    <ThemedText style={styles.actionBtnText}>Mark Added</ThemedText>
                  </TouchableOpacity>
                )}
                {tester.status === 'added' && (
                  <View style={[styles.actionBtnDisabled, { backgroundColor: '#34C75915' }]}>
                    <Ionicons name="checkmark-circle" size={16} color="#34C759" />
                    <ThemedText style={[styles.actionBtnTextDisabled, { color: '#34C759' }]}>Added to Play Console</ThemedText>
                  </View>
                )}
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.text.secondary + '15' }]}
                  onPress={() => handleDelete(tester)}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="phone-portrait-outline" size={48} color={colors.text.secondary} />
            <ThemedText style={styles.emptyTitle}>No Requests Yet</ThemedText>
            <ThemedText style={[styles.emptyText, { color: colors.text.secondary }]}>
              Android tester requests from the web signup form will appear here.
            </ThemedText>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </ThemedView>
  );
}

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
    paddingHorizontal: 20,
  },
  // Stats
  statsBar: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 18,
  },
  statPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  statPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  // Bulk action
  bulkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 18,
  },
  bulkButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Tester Card
  testerCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  testerHeader: {
    marginBottom: 12,
  },
  testerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  testerName: {
    fontSize: 17,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  testerAirline: {
    fontSize: 13,
  },
  // Emails
  emailSection: {
    gap: 8,
    marginBottom: 10,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emailInfo: {
    flex: 1,
  },
  emailLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  emailText: {
    fontSize: 14,
    fontWeight: '500',
  },
  testerDate: {
    fontSize: 12,
    marginBottom: 12,
  },
  // Actions
  testerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionBtnDisabled: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    flex: 1,
  },
  actionBtnTextDisabled: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Empty
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
