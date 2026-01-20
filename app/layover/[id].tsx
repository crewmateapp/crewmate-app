// app/layover/[id].tsx - ENHANCED VERSION
// UPDATED: Now passes layover context (layoverId, layoverCity, fromLayover) when navigating to spots
// This enables smart plan creation - no "Set Layover First" error when creating plans from this layover
import { PlanCard } from '@/components/PlanCard';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import AppHeader from '@/components/AppHeader';
import AppDrawer from '@/components/AppDrawer';
import CreatePlanWizard from '@/components/CreatePlanWizard';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useColors } from '@/hooks/use-theme-color';
import { useAuth } from '@/contexts/AuthContext';
import { Plan } from '@/types/plan';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  updateDoc,
  deleteDoc,
  limit,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  TextInput,
  Modal,
  Share,
  RefreshControl,
} from 'react-native';

type Layover = {
  id: string;
  city: string;
  area: string;
  startDate: any;
  endDate: any;
  status: string;
  preDiscoverable?: boolean;
  notes?: string;
};

type CrewMember = {
  id: string;
  displayName: string;
  photoURL?: string;
  airline?: string;
  base?: string;
  isConnected?: boolean;
  connectionPending?: boolean;
};

type Spot = {
  id: string;
  name: string;
  category: string;
  address: string;
  photoURLs?: string[];
  description?: string;
};

type Weather = {
  temp: number;
  feels_like: number;
  description: string;
  icon: string;
};

export default function LayoverDetailScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [layover, setLayover] = useState<Layover | null>(null);
  const [myPlans, setMyPlans] = useState<Plan[]>([]);
  const [allPlans, setAllPlans] = useState<Plan[]>([]);
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);
  const [connections, setConnections] = useState<Set<string>>(new Set());
  const [pendingRequests, setPendingRequests] = useState<Set<string>>(new Set());
  const [recommendedSpots, setRecommendedSpots] = useState<Spot[]>([]);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  
  // Create Plan Wizard
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  
  // Notes editing
  const [notes, setNotes] = useState('');
  const [editingNotes, setEditingNotes] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  
  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editStartDate, setEditStartDate] = useState(new Date());
  const [editEndDate, setEditEndDate] = useState(new Date());
  
  // Drawer and notifications
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [connectionRequestCount, setConnectionRequestCount] = useState(0);
  const [planNotificationCount, setPlanNotificationCount] = useState(0);
  const [messageCount, setMessageCount] = useState(0);

  useEffect(() => {
    if (id && user) {
      fetchLayoverData();
    }
  }, [id, user]);

  // Listen for incoming connection requests
  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, 'connectionRequests'),
      where('toUserId', '==', user.uid),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setConnectionRequestCount(snapshot.size);
    });

    return () => unsubscribe();
  }, [user]);

  // Listen for unread plan notifications
  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, 'planNotifications'),
      where('userId', '==', user.uid),
      where('read', '==', false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPlanNotificationCount(snapshot.size);
    });

    return () => unsubscribe();
  }, [user]);

  // Listen for unread messages
  useEffect(() => {
    if (!user?.uid) return;

    const connectionsRef = collection(db, 'connections');
    const q = query(
      connectionsRef,
      where('userIds', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let totalUnread = 0;
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        totalUnread += data.unreadCount?.[user.uid] || 0;
      });
      setMessageCount(totalUnread);
    });

    return () => unsubscribe();
  }, [user]);

  const fetchLayoverData = async () => {
    setLoading(true);
    try {
      // First, get the layover data
      const layoverData = await fetchLayover();
      
      if (!layoverData) {
        Alert.alert('Not Found', 'Layover not found');
        router.back();
        return;
      }
      
      // Then fetch everything else in parallel
      await Promise.all([
        fetchMyPlans(),
        fetchConnections(),
      ]);
      
      // Now fetch data that depends on layover
      await Promise.all([
        fetchCrewMembers(),
        fetchAllCityPlans(layoverData),
        fetchRecommendedSpots(layoverData),
        fetchWeather(layoverData),
      ]);
    } catch (error) {
      console.error('Error fetching layover data:', error);
      Alert.alert('Error', 'Failed to load layover details');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLayoverData();
    setRefreshing(false);
  };

  const fetchLayover = async (): Promise<Layover | null> => {
    if (!user?.uid) return null;

    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      const upcomingLayovers = data.upcomingLayovers || [];
      const found = upcomingLayovers.find((l: Layover) => l.id === id);
      
      if (found) {
        setLayover(found);
        setNotes(found.notes || '');
        setEditStartDate(found.startDate?.toDate ? found.startDate.toDate() : new Date(found.startDate));
        setEditEndDate(found.endDate?.toDate ? found.endDate.toDate() : new Date(found.endDate));
        return found;
      }
    }
    return null;
  };

  const fetchMyPlans = async () => {
    if (!user?.uid) return;

    try {
      // Query for plans where user is the host
      const hostedPlansQuery = query(
        collection(db, 'plans'),
        where('hostUserId', '==', user.uid),
        where('layoverId', '==', id),
        where('status', '==', 'active')
      );

      // Query for plans where user is in the attendees array
      const joinedPlansQuery = query(
        collection(db, 'plans'),
        where('attendeeIds', 'array-contains', user.uid),
        where('layoverId', '==', id),
        where('status', '==', 'active')
      );

      // Fetch both queries in parallel
      const [hostedSnapshot, joinedSnapshot] = await Promise.all([
        getDocs(hostedPlansQuery),
        getDocs(joinedPlansQuery)
      ]);

      // Map hosted plans with isHost flag
      const hostedPlans: Plan[] = hostedSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        isHost: true
      } as Plan));

      // Map joined plans with isHost flag
      // Filter out plans where user is also the host (to avoid duplicates)
      const joinedPlans: Plan[] = joinedSnapshot.docs
        .filter(doc => doc.data().hostUserId !== user.uid)
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          isHost: false
        } as Plan));

      // Merge and sort by time
      const allMyPlans = [...hostedPlans, ...joinedPlans].sort((a, b) => {
        const aTime = a.scheduledTime?.toDate ? a.scheduledTime.toDate() : new Date(a.scheduledTime);
        const bTime = b.scheduledTime?.toDate ? b.scheduledTime.toDate() : new Date(b.scheduledTime);
        return aTime.getTime() - bTime.getTime();
      });

      setMyPlans(allMyPlans);
    } catch (error) {
      console.error('Error fetching plans:', error);
    }
  };

  const fetchAllCityPlans = async (layoverData?: Layover) => {
    const targetLayover = layoverData || layover;
    if (!targetLayover || !user?.uid) return;

    try {
      const startDate = targetLayover.startDate?.toDate ? targetLayover.startDate.toDate() : new Date(targetLayover.startDate);
      const endDate = targetLayover.endDate?.toDate ? targetLayover.endDate.toDate() : new Date(targetLayover.endDate);

      // Get all active plans in this city
      const plansQuery = query(
        collection(db, 'plans'),
        where('city', '==', targetLayover.city),
        where('status', '==', 'active')
      );

      const plansSnap = await getDocs(plansQuery);
      const plans: Plan[] = [];

      plansSnap.docs.forEach(doc => {
        const plan = { id: doc.id, ...doc.data() } as Plan;
        
        // Skip user's own plans
        if (plan.hostUserId === user.uid) return;
        
        // Check if plan time overlaps with layover
        const planTime = plan.scheduledTime?.toDate ? plan.scheduledTime.toDate() : new Date(plan.scheduledTime);
        if (planTime >= startDate && planTime <= endDate) {
          plans.push(plan);
        }
      });

      // Sort by time
      plans.sort((a, b) => {
        const aTime = a.scheduledTime?.toDate ? a.scheduledTime.toDate() : new Date(a.scheduledTime);
        const bTime = b.scheduledTime?.toDate ? b.scheduledTime.toDate() : new Date(b.scheduledTime);
        return aTime.getTime() - bTime.getTime();
      });

      setAllPlans(plans);
    } catch (error) {
      console.error('Error fetching all city plans:', error);
    }
  };

  const fetchRecommendedSpots = async (layoverData?: Layover) => {
    const targetLayover = layoverData || layover;
    if (!targetLayover) return;

    try {
      const spotsQuery = query(
        collection(db, 'spots'),
        where('city', '==', targetLayover.city),
        where('status', '==', 'approved'),
        where('recommended', '==', true),
        limit(5)
      );

      const spotsSnap = await getDocs(spotsQuery);
      const spots: Spot[] = spotsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Spot));

      setRecommendedSpots(spots);
    } catch (error) {
      console.error('Error fetching recommended spots:', error);
    }
  };

  const fetchWeather = async (layoverData?: Layover) => {
    const targetLayover = layoverData || layover;
    if (!targetLayover) return;

    setWeatherLoading(true);
    try {
      const apiKey = 'a4bd31a5e3bd40c9ee5799b847689643';
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(targetLayover.city)}&units=imperial&appid=${apiKey}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setWeather({
          temp: Math.round(data.main.temp),
          feels_like: Math.round(data.main.feels_like),
          description: data.weather[0].description,
          icon: data.weather[0].icon,
        });
      } else {
        console.log('Weather API response not OK:', response.status);
      }
    } catch (error) {
      console.error('Error fetching weather:', error);
      // Retry once after 1 second if first attempt fails
      setTimeout(async () => {
        try {
          const apiKey = 'a4bd31a5e3bd40c9ee5799b847689643';
          const response = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(targetLayover.city)}&units=imperial&appid=${apiKey}`
          );
          if (response.ok) {
            const data = await response.json();
            setWeather({
              temp: Math.round(data.main.temp),
              feels_like: Math.round(data.main.feels_like),
              description: data.weather[0].description,
              icon: data.weather[0].icon,
            });
          }
        } catch (retryError) {
          console.error('Weather retry failed:', retryError);
        }
      }, 1000);
    } finally {
      setWeatherLoading(false);
    }
  };

  const fetchConnections = async () => {
    if (!user?.uid) return;

    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const connectedIds = new Set(userData.connections || []);
        setConnections(connectedIds);

        const pendingQuery = query(
          collection(db, 'connectionRequests'),
          where('fromUserId', '==', user.uid),
          where('status', '==', 'pending')
        );
        const pendingSnap = await getDocs(pendingQuery);
        const pending = new Set(pendingSnap.docs.map(doc => doc.data().toUserId));
        setPendingRequests(pending);
      }
    } catch (error) {
      console.error('Error fetching connections:', error);
    }
  };

  const fetchCrewMembers = async () => {
    if (!layover) return;

    try {
      const startDate = layover.startDate?.toDate ? layover.startDate.toDate() : new Date(layover.startDate);
      const endDate = layover.endDate?.toDate ? layover.endDate.toDate() : new Date(layover.endDate);

      const usersQuery = query(collection(db, 'users'));
      const usersSnap = await getDocs(usersQuery);
      
      const crew: CrewMember[] = [];

      usersSnap.docs.forEach((userDoc) => {
        if (userDoc.id === user?.uid) return;

        const userData = userDoc.data();
        const upcomingLayovers = userData.upcomingLayovers || [];

        const matchingLayover = upcomingLayovers.find((l: any) => {
          if (l.city !== layover.city) return false;
          
          const lStart = l.startDate?.toDate ? l.startDate.toDate() : new Date(l.startDate);
          const lEnd = l.endDate?.toDate ? l.endDate.toDate() : new Date(l.endDate);
          
          return (lStart <= endDate && lEnd >= startDate);
        });

        if (matchingLayover && matchingLayover.preDiscoverable) {
          crew.push({
            id: userDoc.id,
            displayName: userData.displayName || 'Crew Member',
            photoURL: userData.photoURL,
            airline: userData.airline,
            base: userData.base,
            isConnected: connections.has(userDoc.id),
            connectionPending: pendingRequests.has(userDoc.id),
          });
        }
      });

      setCrewMembers(crew);
    } catch (error) {
      console.error('Error fetching crew members:', error);
    }
  };

  const handleConnect = async (crewMember: CrewMember) => {
    if (!user?.uid) return;

    try {
      await addDoc(collection(db, 'connectionRequests'), {
        fromUserId: user.uid,
        toUserId: crewMember.id,
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      setPendingRequests(prev => new Set([...prev, crewMember.id]));
      Alert.alert('Request Sent!', `Connection request sent to ${crewMember.displayName}`);
    } catch (error) {
      console.error('Error sending connection request:', error);
      Alert.alert('Error', 'Failed to send connection request');
    }
  };

  const handleSaveNotes = async () => {
    if (!user?.uid || !layover) return;

    setSavingNotes(true);
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        const upcomingLayovers = data.upcomingLayovers || [];
        
        const updatedLayovers = upcomingLayovers.map((l: Layover) => 
          l.id === id ? { ...l, notes } : l
        );

        await updateDoc(doc(db, 'users', user.uid), {
          upcomingLayovers: updatedLayovers
        });

        setEditingNotes(false);
        Alert.alert('Success', 'Notes saved!');
      }
    } catch (error) {
      console.error('Error saving notes:', error);
      Alert.alert('Error', 'Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleDeleteLayover = async () => {
    Alert.alert(
      'Delete Layover',
      'Are you sure you want to delete this layover?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!user?.uid) return;

              const userDoc = await getDoc(doc(db, 'users', user.uid));
              if (userDoc.exists()) {
                const data = userDoc.data();
                const upcomingLayovers = data.upcomingLayovers || [];
                
                const updatedLayovers = upcomingLayovers.filter((l: Layover) => l.id !== id);

                await updateDoc(doc(db, 'users', user.uid), {
                  upcomingLayovers: updatedLayovers
                });

                Alert.alert('Deleted', 'Layover deleted successfully');
                router.back();
              }
            } catch (error) {
              console.error('Error deleting layover:', error);
              Alert.alert('Error', 'Failed to delete layover');
            }
          }
        }
      ]
    );
  };

  const handleShare = async () => {
    if (!layover) return;

    try {
      const message = `I'll be in ${layover.city} from ${formatDateRange(layover.startDate, layover.endDate)}! Want to meet up?`;
      
      await Share.share({
        message,
        title: `Layover in ${layover.city}`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const formatDateRange = (startDate: any, endDate: any) => {
    const start = startDate?.toDate ? startDate.toDate() : new Date(startDate);
    const end = endDate?.toDate ? endDate.toDate() : new Date(endDate);
    
    const startStr = start.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

    if (start.toDateString() === end.toDateString()) {
      return startStr;
    }
    
    const endStr = end.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    
    return `${startStr} - ${endStr}`;
  };

  const getDaysUntil = () => {
    if (!layover) return '';
    const date = layover.startDate?.toDate ? layover.startDate.toDate() : new Date(layover.startDate);
    const now = new Date();
    const diff = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff < 0) return 'Past';
    return `${diff} days away`;
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'food': return 'restaurant';
      case 'coffee': return 'cafe';
      case 'bar': return 'beer';
      case 'activity': return 'fitness';
      case 'shopping': return 'cart';
      default: return 'location';
    }
  };

  if (loading || !layover) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <ThemedView style={styles.container}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={28} color={Colors.primary} />
            </TouchableOpacity>
            <View style={{ width: 28 }} />
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        </ThemedView>
      </SafeAreaView>
    );
  }

  const totalUnreadCount = connectionRequestCount + planNotificationCount + messageCount;

  return (
    <>
      <AppDrawer 
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
      />
      
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <ThemedView style={styles.container}>
          {/* App Header */}
          <AppHeader
            onMenuPress={() => setDrawerVisible(true)}
            unreadCount={totalUnreadCount}
          />
          
          {/* Action Buttons Row */}
          <View style={[styles.actionBar, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="chevron-back" size={28} color={Colors.primary} />
            </TouchableOpacity>
            <View style={styles.headerActions}>
              <TouchableOpacity 
                style={[styles.headerButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={handleShare}
              >
                <Ionicons name="share-outline" size={20} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.headerButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => setShowEditModal(true)}
              >
                <Ionicons name="pencil-outline" size={20} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.headerButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={handleDeleteLayover}
              >
                <Ionicons name="trash-outline" size={20} color={Colors.error} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
        >
          {/* Layover Info Card */}
          <View style={[styles.layoverCard, { borderBottomColor: colors.border }]}>
            <View style={[styles.layoverIcon, { backgroundColor: Colors.primary + '15' }]}>
              <Ionicons name="airplane" size={32} color={Colors.primary} />
            </View>
            <ThemedText style={[styles.cityName, { color: colors.text.primary }]}>{layover.city}</ThemedText>
            <ThemedText style={[styles.areaName, { color: colors.text.secondary }]}>{layover.area}</ThemedText>
            <ThemedText style={[styles.dates, { color: colors.text.secondary }]}>
              {formatDateRange(layover.startDate, layover.endDate)}
            </ThemedText>
            <View style={[styles.countdownBadge, { 
              backgroundColor: Colors.primary + '15',
              borderColor: Colors.primary
            }]}>
              <ThemedText style={[styles.countdownText, { color: Colors.primary }]}>
                {getDaysUntil()}
              </ThemedText>
            </View>
          </View>

          {/* Weather Widget */}
          {weather && (
            <View style={[styles.weatherCard, { 
              backgroundColor: colors.card,
              borderColor: colors.border
            }]}>
              <View style={styles.weatherLeft}>
                <Image 
                  source={{ uri: `https://openweathermap.org/img/wn/${weather.icon}@2x.png` }}
                  style={styles.weatherIcon}
                />
                <View>
                  <ThemedText style={styles.weatherTemp}>{weather.temp}°F</ThemedText>
                  <ThemedText style={[styles.weatherDesc, { color: colors.text.secondary }]}>
                    {weather.description}
                  </ThemedText>
                </View>
              </View>
              <ThemedText style={[styles.weatherFeels, { color: colors.text.secondary }]}>
                Feels like {weather.feels_like}°
              </ThemedText>
            </View>
          )}

          {/* Notes Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText style={[styles.sectionTitle, { color: colors.text.primary }]}>My Notes</ThemedText>
              {!editingNotes && (
                <TouchableOpacity onPress={() => setEditingNotes(true)}>
                  <Ionicons name="pencil" size={18} color={Colors.primary} />
                </TouchableOpacity>
              )}
            </View>
            {editingNotes ? (
              <View>
                <TextInput
                  style={[styles.notesInput, { 
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    color: colors.text.primary
                  }]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Add notes about this layover..."
                  placeholderTextColor={colors.text.secondary}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
                <View style={styles.notesActions}>
                  <TouchableOpacity 
                    style={[styles.notesButton, { borderColor: colors.border }]}
                    onPress={() => {
                      setNotes(layover.notes || '');
                      setEditingNotes(false);
                    }}
                  >
                    <ThemedText style={[styles.notesButtonText, { color: colors.text.secondary }]}>
                      Cancel
                    </ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.notesButton, styles.notesButtonPrimary]}
                    onPress={handleSaveNotes}
                    disabled={savingNotes}
                  >
                    {savingNotes ? (
                      <ActivityIndicator size="small" color={Colors.white} />
                    ) : (
                      <ThemedText style={styles.notesButtonTextPrimary}>Save</ThemedText>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={[styles.notesDisplay, { 
                backgroundColor: colors.card,
                borderColor: colors.border
              }]}>
                {notes ? (
                  <ThemedText style={[styles.notesText, { color: colors.text.primary }]}>
                    {notes}
                  </ThemedText>
                ) : (
                  <ThemedText style={[styles.notesEmpty, { color: colors.text.secondary }]}>
                    No notes yet. Tap the pencil to add some!
                  </ThemedText>
                )}
              </View>
            )}
          </View>

          {/* Quick Actions */}
          <View style={styles.quickActions}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => setShowCreateWizard(true)}
            >
              <Ionicons name="add-circle-outline" size={20} color={Colors.white} />
              <ThemedText style={styles.actionButtonText}>Create Plan</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, styles.actionButtonSecondary, {
                backgroundColor: colors.background,
                borderColor: colors.border
              }]}
              onPress={() => router.push(`/explore?city=${layover.city}`)}
            >
              <Ionicons name="compass-outline" size={20} color={Colors.primary} />
              <ThemedText style={[styles.actionButtonTextSecondary, { color: Colors.primary }]}>
                Explore
              </ThemedText>
            </TouchableOpacity>
          </View>

          {/* My Plans Section */}
          {myPlans.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <ThemedText style={[styles.sectionTitle, { color: colors.text.primary }]}>My Plans</ThemedText>
              </View>
              {myPlans.map(plan => (
                <View key={plan.id} style={{ position: 'relative' }}>
                  {!plan.isHost && (
                    <View style={styles.joinedBadge}>
                      <ThemedText style={styles.joinedBadgeText}>Joined</ThemedText>
                    </View>
                  )}
                  <PlanCard plan={plan} />
                </View>
              ))}
            </View>
          )}

          {/* All City Plans */}
          {allPlans.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <ThemedText style={[styles.sectionTitle, { color: colors.text.primary }]}>
                  Other Plans in {layover.city}
                </ThemedText>
                <ThemedText style={[styles.sectionCount, { color: colors.text.secondary }]}>
                  {allPlans.length}
                </ThemedText>
              </View>
              {allPlans.map(plan => (
                <PlanCard key={plan.id} plan={plan} />
              ))}
            </View>
          )}

          {/* Recommended Spots */}
          {recommendedSpots.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <ThemedText style={[styles.sectionTitle, { color: colors.text.primary }]}>Recommended Spots</ThemedText>
                <TouchableOpacity onPress={() => router.push(`/explore?city=${layover.city}`)}>
                  <ThemedText style={[styles.viewAllLink, { color: Colors.primary }]}>
                    View All
                  </ThemedText>
                </TouchableOpacity>
              </View>
              {recommendedSpots.map((spot) => (
                <TouchableOpacity
                  key={spot.id}
                  style={[styles.spotCard, {
                    backgroundColor: colors.card,
                    borderColor: colors.border
                  }]}
                  onPress={() => router.push({
                    pathname: `/spot/${spot.id}`,
                    params: {
                      layoverId: id,
                      layoverCity: layover?.city || '',
                      fromLayover: 'true'
                    }
                  })}
                  activeOpacity={0.7}
                >
                  {spot.photoURLs && spot.photoURLs.length > 0 ? (
                    <Image 
                      source={{ uri: spot.photoURLs[0] }} 
                      style={styles.spotImage}
                    />
                  ) : (
                    <View style={[styles.spotImagePlaceholder, { backgroundColor: colors.border }]}>
                      <Ionicons 
                        name={getCategoryIcon(spot.category) as any} 
                        size={24} 
                        color={colors.text.secondary} 
                      />
                    </View>
                  )}
                  <View style={styles.spotInfo}>
                    <ThemedText style={[styles.spotName, { color: colors.text.primary }]}>{spot.name}</ThemedText>
                    {spot.description && (
                      <ThemedText 
                        style={[styles.spotDesc, { color: colors.text.secondary }]}
                        numberOfLines={2}
                      >
                        {spot.description}
                      </ThemedText>
                    )}
                    <ThemedText style={[styles.spotAddress, { color: colors.text.secondary }]}>
                      {spot.address}
                    </ThemedText>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Crew Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText style={[styles.sectionTitle, { color: colors.text.primary }]}>
                Crew on this Layover
              </ThemedText>
              <ThemedText style={[styles.sectionCount, { color: colors.text.secondary }]}>
                {crewMembers.length}
              </ThemedText>
            </View>

            {crewMembers.length > 0 ? (
              crewMembers.slice(0, 5).map((member) => (
                <TouchableOpacity
                  key={member.id}
                  style={[styles.crewCard, {
                    backgroundColor: colors.card,
                    borderColor: colors.border
                  }]}
                  onPress={() => router.push(`/profile/${member.id}`)}
                  activeOpacity={0.7}
                >
                  <View style={styles.crewCardContent}>
                    {member.photoURL ? (
                      <Image source={{ uri: member.photoURL }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, styles.avatarPlaceholder, { 
                        backgroundColor: colors.border 
                      }]}>
                        <Ionicons name="person" size={20} color={colors.text.secondary} />
                      </View>
                    )}

                    <View style={styles.crewInfo}>
                      <ThemedText style={[styles.crewName, { color: colors.text.primary }]}>{member.displayName}</ThemedText>
                      {member.airline && (
                        <ThemedText style={[styles.crewDetail, { color: colors.text.secondary }]}>
                          {member.airline} {member.base ? `• ${member.base}` : ''}
                        </ThemedText>
                      )}
                    </View>
                  </View>

                  {member.isConnected ? (
                    <View style={[styles.connectedBadge, { backgroundColor: Colors.success + '10' }]}>
                      <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                      <ThemedText style={[styles.connectedText, { color: Colors.success }]}>
                        Connected
                      </ThemedText>
                    </View>
                  ) : member.connectionPending ? (
                    <View style={[styles.pendingBadge, { 
                      backgroundColor: colors.text.secondary + '20' 
                    }]}>
                      <ThemedText style={[styles.pendingText, { color: colors.text.secondary }]}>
                        Pending
                      </ThemedText>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.connectButton, {
                        backgroundColor: colors.background,
                        borderColor: colors.border
                      }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleConnect(member);
                      }}
                    >
                      <Ionicons name="person-add-outline" size={16} color={Colors.primary} />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={48} color={colors.text.secondary} />
                <ThemedText style={[styles.emptyText, { color: colors.text.secondary }]}>
                  No crew found yet
                </ThemedText>
                <ThemedText style={[styles.emptyHint, { color: colors.text.secondary }]}>
                  Others will appear here as they add this layover
                </ThemedText>
              </View>
            )}

            {crewMembers.length > 5 && (
              <TouchableOpacity
                style={styles.viewAllButton}
                onPress={() => {
                  const startDate = layover.startDate?.toDate ? layover.startDate.toDate() : new Date(layover.startDate);
                  router.push(`/discover-crew?city=${layover.city}&date=${startDate.toISOString()}&layoverId=${layover.id}`);
                }}
              >
                <ThemedText style={[styles.viewAllText, { color: Colors.primary }]}>
                  View All {crewMembers.length} Crew Members
                </ThemedText>
                <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
              </TouchableOpacity>
            )}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>

      {/* Edit Modal - Simple for now, can enhance later */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Edit Layover</ThemedText>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>
            <ThemedText style={[styles.modalHint, { color: colors.text.secondary }]}>
              Editing dates coming soon! For now, delete and re-add if your schedule changes.
            </ThemedText>
            <TouchableOpacity 
              style={styles.modalButton}
              onPress={() => setShowEditModal(false)}
            >
              <ThemedText style={styles.modalButtonText}>Got it</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Create Plan Wizard */}
      <CreatePlanWizard
        isOpen={showCreateWizard}
        onClose={() => setShowCreateWizard(false)}
        layoverId={id}
        layoverCity={layover?.city}
      />
      </ThemedView>
    </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  joinedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: Colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 10,
  },
  joinedBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  layoverCard: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  layoverIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  cityName: {
    fontSize: 25,
    fontWeight: '700',
    marginBottom: 6,
  },
  areaName: {
    fontSize: 16,
    marginBottom: 12,
  },
  dates: {
    fontSize: 15,
    marginBottom: 16,
  },
  countdownBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  countdownText: {
    fontSize: 14,
    fontWeight: '600',
  },
  weatherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  weatherLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  weatherIcon: {
    width: 50,
    height: 50,
  },
  weatherTemp: {
    fontSize: 24,
    fontWeight: '700',
  },
  weatherDesc: {
    fontSize: 14,
    textTransform: 'capitalize',
  },
  weatherFeels: {
    fontSize: 13,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionCount: {
    fontSize: 16,
    fontWeight: '600',
  },
  viewAllLink: {
    fontSize: 14,
    fontWeight: '600',
  },
  notesInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 15,
    minHeight: 100,
    marginBottom: 12,
  },
  notesActions: {
    flexDirection: 'row',
    gap: 12,
  },
  notesButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  notesButtonPrimary: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  notesButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  notesButtonTextPrimary: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
  },
  notesDisplay: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    minHeight: 80,
  },
  notesText: {
    fontSize: 15,
    lineHeight: 22,
  },
  notesEmpty: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtonSecondary: {
    borderWidth: 1,
  },
  actionButtonTextSecondary: {
    fontSize: 16,
    fontWeight: '600',
  },
  spotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    gap: 12,
  },
  spotImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  spotImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotInfo: {
    flex: 1,
    gap: 4,
  },
  spotName: {
    fontSize: 16,
    fontWeight: '600',
  },
  spotDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  spotAddress: {
    fontSize: 12,
  },
  crewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
  },
  crewCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  crewInfo: {
    flex: 1,
  },
  crewName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  crewDetail: {
    fontSize: 13,
  },
  connectButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  connectedText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pendingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  pendingText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptyHint: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 8,
    gap: 6,
  },
  viewAllText: {
    fontSize: 15,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalHint: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
