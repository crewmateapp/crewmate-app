// app/manage-admins.tsx
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { isSuperAdmin, useAdminRole } from '@/hooks/useAdminRole';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type AdminUser = {
  id: string;
  displayName: string;
  email: string;
  photoURL?: string;
  adminRole: 'super' | 'city' | null;
  adminCities?: string[];
};

export default function ManageAdminsScreen() {
  const { user } = useAuth();
  const { role, loading: roleLoading } = useAdminRole();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCityModal, setShowCityModal] = useState(false);
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResults, setSearchResults] = useState<AdminUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);

  // Load all admins
  useEffect(() => {
    if (!user || roleLoading) return;

    const adminsQuery = query(
      collection(db, 'users'),
      where('adminRole', 'in', ['super', 'city'])
    );

    const unsubscribe = onSnapshot(adminsQuery, (snapshot) => {
      const adminList: AdminUser[] = [];
      snapshot.docs.forEach((doc) => {
        adminList.push({
          id: doc.id,
          ...doc.data(),
        } as AdminUser);
      });
      setAdmins(adminList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, roleLoading]);

  const searchUsers = async () => {
    if (!searchEmail.trim()) return;

    setSearching(true);
    try {
      const usersQuery = query(
        collection(db, 'users'),
        where('email', '==', searchEmail.trim().toLowerCase())
      );
      const snapshot = await getDocs(usersQuery);

      const results: AdminUser[] = [];
      snapshot.docs.forEach((doc) => {
        results.push({
          id: doc.id,
          ...doc.data(),
        } as AdminUser);
      });

      setSearchResults(results);
      if (results.length === 0) {
        Alert.alert('Not Found', 'No user found with that email.');
      }
    } catch (error) {
      console.error('Error searching users:', error);
      Alert.alert('Error', 'Failed to search users.');
    } finally {
      setSearching(false);
    }
  };

  const handleMakeSuperAdmin = async (userId: string, userName: string) => {
    Alert.alert(
      'Make Super Admin',
      `Make ${userName} a Super Admin? They will have full control over all cities.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'users', userId), {
                adminRole: 'super',
                adminCities: [],
              });
              Alert.alert('Success', `${userName} is now a Super Admin.`);
              setShowAddModal(false);
              setSearchEmail('');
              setSearchResults([]);
            } catch (error) {
              console.error('Error making super admin:', error);
              Alert.alert('Error', 'Failed to update admin role.');
            }
          },
        },
      ]
    );
  };

  const handleMakeCityAdmin = (userInfo: AdminUser) => {
    setSelectedUser(userInfo);
    setSelectedCities(userInfo.adminCities || []);
    setShowCityModal(true);
  };

  const toggleCity = (cityName: string) => {
    setSelectedCities((prev) =>
      prev.includes(cityName)
        ? prev.filter((c) => c !== cityName)
        : [...prev, cityName]
    );
  };

  const saveCityAdmin = async () => {
    if (!selectedUser) return;

    if (selectedCities.length === 0) {
      Alert.alert('Error', 'Please select at least one city.');
      return;
    }

    try {
      await updateDoc(doc(db, 'users', selectedUser.id), {
        adminRole: 'city',
        adminCities: selectedCities,
      });
      Alert.alert('Success', `${selectedUser.displayName} is now a City Admin.`);
      setShowCityModal(false);
      setShowAddModal(false);
      setSelectedUser(null);
      setSelectedCities([]);
      setSearchEmail('');
      setSearchResults([]);
    } catch (error) {
      console.error('Error making city admin:', error);
      Alert.alert('Error', 'Failed to update admin role.');
    }
  };

  const handleRemoveAdmin = async (userId: string, userName: string) => {
    Alert.alert(
      'Remove Admin',
      `Remove admin access from ${userName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'users', userId), {
                adminRole: null,
                adminCities: [],
              });
              Alert.alert('Removed', `${userName} is no longer an admin.`);
            } catch (error) {
              console.error('Error removing admin:', error);
              Alert.alert('Error', 'Failed to remove admin.');
            }
          },
        },
      ]
    );
  };

  const renderAdmin = ({ item }: { item: AdminUser }) => (
    <View style={styles.adminCard}>
      <View style={styles.adminInfo}>
        <ThemedText style={styles.adminName}>{item.displayName}</ThemedText>
        <ThemedText style={styles.adminEmail}>{item.email}</ThemedText>
        <View style={styles.roleContainer}>
          {item.adminRole === 'super' ? (
            <View style={styles.superBadge}>
              <Ionicons name="shield" size={14} color={Colors.white} />
              <ThemedText style={styles.badgeText}>Super Admin</ThemedText>
            </View>
          ) : (
            <View style={styles.cityBadge}>
              <Ionicons name="location" size={14} color={Colors.white} />
              <ThemedText style={styles.badgeText}>
                {item.adminCities?.join(', ') || 'No cities'}
              </ThemedText>
            </View>
          )}
        </View>
      </View>

      <View style={styles.adminActions}>
        {item.adminRole === 'city' && (
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => handleMakeCityAdmin(item)}
          >
            <Ionicons name="pencil" size={18} color={Colors.primary} />
          </TouchableOpacity>
        )}
        {item.id !== user?.uid && (
          <TouchableOpacity
            style={styles.removeBtn}
            onPress={() => handleRemoveAdmin(item.id, item.displayName)}
          >
            <Ionicons name="trash" size={18} color={Colors.error} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderSearchResult = ({ item }: { item: AdminUser }) => (
    <View style={styles.searchResultCard}>
      <View style={styles.adminInfo}>
        <ThemedText style={styles.adminName}>{item.displayName}</ThemedText>
        <ThemedText style={styles.adminEmail}>{item.email}</ThemedText>
        {item.adminRole && (
          <ThemedText style={styles.alreadyAdmin}>
            Already {item.adminRole === 'super' ? 'Super' : 'City'} Admin
          </ThemedText>
        )}
      </View>

      <View style={styles.searchActions}>
        <TouchableOpacity
          style={styles.superBtn}
          onPress={() => handleMakeSuperAdmin(item.id, item.displayName)}
        >
          <ThemedText style={styles.superBtnText}>Super</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.cityBtn}
          onPress={() => handleMakeCityAdmin(item)}
        >
          <ThemedText style={styles.cityBtnText}>City</ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading || roleLoading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 100 }} />
      </ThemedView>
    );
  }

  if (!isSuperAdmin(role)) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.noAccessContainer}>
          <Ionicons name="lock-closed" size={60} color={Colors.text.secondary} />
          <ThemedText style={styles.noAccessText}>Super Admin access required</ThemedText>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <ThemedText style={styles.backBtnText}>Go Back</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <ThemedText type="title" style={styles.title}>
          Manage Admins
        </ThemedText>
      </View>

      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => setShowAddModal(true)}
      >
        <Ionicons name="add-circle" size={20} color={Colors.white} />
        <ThemedText style={styles.addBtnText}>Add Admin</ThemedText>
      </TouchableOpacity>

      <FlatList
        data={admins}
        renderItem={renderAdmin}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={60} color={Colors.text.secondary} />
            <ThemedText style={styles.emptyText}>No admins yet</ThemedText>
          </View>
        }
      />

      {/* Add Admin Modal */}
      <Modal visible={showAddModal} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>Add Admin</ThemedText>
            <TouchableOpacity onPress={() => {
              setShowAddModal(false);
              setSearchEmail('');
              setSearchResults([]);
            }}>
              <ThemedText style={styles.cancelText}>Cancel</ThemedText>
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Enter user email..."
              placeholderTextColor={Colors.text.secondary}
              value={searchEmail}
              onChangeText={setSearchEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TouchableOpacity
              style={styles.searchBtn}
              onPress={searchUsers}
              disabled={searching}
            >
              {searching ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Ionicons name="search" size={20} color={Colors.white} />
              )}
            </TouchableOpacity>
          </View>

          <FlatList
            data={searchResults}
            renderItem={renderSearchResult}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.searchResults}
          />
        </SafeAreaView>
      </Modal>

      {/* City Selection Modal */}
      <Modal visible={showCityModal} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>Select Cities</ThemedText>
            <TouchableOpacity onPress={() => {
              setShowCityModal(false);
              setSelectedUser(null);
              setSelectedCities([]);
            }}>
              <ThemedText style={styles.cancelText}>Cancel</ThemedText>
            </TouchableOpacity>
          </View>

          <ThemedText style={styles.citySubtitle}>
            {selectedUser?.displayName} will manage these cities:
          </ThemedText>

          <ScrollView style={styles.cityList}>
            {cities.map((city) => (
              <TouchableOpacity
                key={city.code}
                style={[
                  styles.cityItem,
                  selectedCities.includes(city.name) && styles.cityItemSelected,
                ]}
                onPress={() => toggleCity(city.name)}
              >
                <ThemedText
                  style={[
                    styles.cityName,
                    selectedCities.includes(city.name) && styles.cityNameSelected,
                  ]}
                >
                  {city.name} ({city.code})
                </ThemedText>
                {selectedCities.includes(city.name) && (
                  <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.cityModalFooter}>
            <ThemedText style={styles.selectedCount}>
              {selectedCities.length} cities selected
            </ThemedText>
            <TouchableOpacity style={styles.saveBtn} onPress={saveCityAdmin}>
              <ThemedText style={styles.saveBtnText}>Save</ThemedText>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  backButton: {
    marginRight: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    marginHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  addBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  adminCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  adminInfo: {
    flex: 1,
  },
  adminName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  adminEmail: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  roleContainer: {
    flexDirection: 'row',
  },
  superBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#9C27B0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  cityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    flexShrink: 1,
  },
  badgeText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  adminActions: {
    flexDirection: 'row',
    gap: 12,
  },
  editBtn: {
    padding: 8,
  },
  removeBtn: {
    padding: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginTop: 12,
  },
  noAccessContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  noAccessText: {
    fontSize: 18,
    color: Colors.text.secondary,
  },
  backBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 10,
  },
  backBtnText: {
    color: Colors.white,
    fontWeight: '600',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  cancelText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text.primary,
    backgroundColor: Colors.card,
  },
  searchBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchResults: {
    paddingHorizontal: 20,
  },
  searchResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  alreadyAdmin: {
    fontSize: 12,
    color: '#9C27B0',
    marginTop: 4,
  },
  searchActions: {
    flexDirection: 'row',
    gap: 8,
  },
  superBtn: {
    backgroundColor: '#9C27B0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  superBtnText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  cityBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cityBtnText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  // City selection modal
  citySubtitle: {
    fontSize: 15,
    color: Colors.text.secondary,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  cityList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  cityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: Colors.card,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cityItemSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
  },
  cityName: {
    fontSize: 16,
    color: Colors.text.primary,
  },
  cityNameSelected: {
    fontWeight: '600',
    color: Colors.primary,
  },
  cityModalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  selectedCount: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 10,
  },
  saveBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
