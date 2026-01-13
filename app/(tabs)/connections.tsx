import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { notifyConnectionAccepted } from '@/utils/notifications';
import { router, useLocalSearchParams } from 'expo-router';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where
} from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

type ConnectionRequest = {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  status: 'pending' | 'accepted' | 'declined';
  photoURL?: string;
};

type Connection = {
  id: string;
  oduserId: string;
  displayName: string;
  photoURL?: string;
  position?: string;
  airline?: string;
};

type PositionFilter = 'all' | 'Flight Attendant' | 'First Officer' | 'Captain';
type SortOption = 'a-z' | 'z-a' | 'recent';

export default function ConnectionsScreen() {
  const { user } = useAuth();
  
  // Get route params for filtering nearby crew
  const { filter, city, area } = useLocalSearchParams<{
    filter?: 'area' | 'city';
    city?: string;
    area?: string;
  }>();
  
  const [nearbyCrew, setNearbyCrew] = useState<Connection[]>([]);
  const [activeTab, setActiveTab] = useState<'connections' | 'nearby'>(
    filter ? 'nearby' : 'connections'
  );
  const [loading, setLoading] = useState(true);
  const [incomingRequests, setIncomingRequests] = useState<ConnectionRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<ConnectionRequest[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [positionFilter, setPositionFilter] = useState<PositionFilter>('all');
  const [airlineFilter, setAirlineFilter] = useState<string>('all');
  const [sortOption, setSortOption] = useState<SortOption>('a-z');
  const [showFilterModal, setShowFilterModal] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;

    const incomingQuery = query(
      collection(db, 'connectionRequests'),
      where('toUserId', '==', user.uid),
      where('status', '==', 'pending')
    );

    const unsubIncoming = onSnapshot(incomingQuery, async (snapshot) => {
      const requests = await Promise.all(
        snapshot.docs.map(async (requestDoc) => {
          const data = requestDoc.data();
          
          // Fetch the sender's profile photo
          let photoURL: string | undefined = undefined;
          try {
            const userDoc = await getDoc(doc(db, 'users', data.fromUserId));
            if (userDoc.exists()) {
              photoURL = userDoc.data()?.photoURL;
            }
          } catch (error) {
            console.error('Error fetching user profile:', error);
          }
          
          return {
            id: requestDoc.id,
            ...data,
            photoURL,
          };
        })
      );
      setIncomingRequests(requests as ConnectionRequest[]);
      setLoading(false);
    });

    const outgoingQuery = query(
      collection(db, 'connectionRequests'),
      where('fromUserId', '==', user.uid),
      where('status', '==', 'pending')
    );

    const unsubOutgoing = onSnapshot(outgoingQuery, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ConnectionRequest[];
      setOutgoingRequests(requests);
    });

    const connectionsQuery = query(
      collection(db, 'connections'),
      where('userIds', 'array-contains', user.uid)
    );

    const unsubConnections = onSnapshot(connectionsQuery, async (snapshot) => {
      const conns = await Promise.all(
        snapshot.docs.map(async (connectionDoc) => {
          const data = connectionDoc.data();
          const otherUserId = data.userIds.find((id: string) => id !== user.uid);
          const otherUserName = data.userNames?.[otherUserId] || 'Unknown';
          
          // Fetch the user's profile to get their photo, position, and airline
          let photoURL: string | undefined = undefined;
          let position: string | undefined = undefined;
          let airline: string | undefined = undefined;
          let displayName = otherUserName;
          
          try {
            const userDoc = await getDoc(doc(db, 'users', otherUserId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              photoURL = userData?.photoURL;
              position = userData?.position;
              airline = userData?.airline;
              if (userData?.displayName) {
                displayName = userData.displayName;
              }
            }
          } catch (error) {
            console.error('Error fetching user profile:', error);
          }
          
          return {
            id: connectionDoc.id,
            oduserId: otherUserId,
            displayName,
            photoURL,
            position,
            airline,
          };
        })
      );
      setConnections(conns);
    });

    return () => {
      unsubIncoming();
      unsubOutgoing();
      unsubConnections();
    };
  }, [user]);

  // Fetch nearby crew when filter params are present
  useEffect(() => {
    if (!user?.uid || !filter || !city) {
      setNearbyCrew([]);
      return;
    }

    let q;
    if (filter === 'area' && area) {
      // Show crew in specific area
      q = query(
        collection(db, 'users'),
        where('currentLayover.city', '==', city),
        where('currentLayover.area', '==', area),
        where('currentLayover.discoverable', '==', true),
        where('currentLayover.isLive', '==', true)
      );
    } else if (filter === 'city') {
      // Show all crew in city
      q = query(
        collection(db, 'users'),
        where('currentLayover.city', '==', city),
        where('currentLayover.discoverable', '==', true),
        where('currentLayover.isLive', '==', true)
      );
    } else {
      setNearbyCrew([]);
      return;
    }

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const crew = await Promise.all(
        snapshot.docs
          .filter(doc => doc.id !== user.uid) // Exclude current user
          .map(async (userDoc) => {
            const userData = userDoc.data();
            return {
              id: userDoc.id,
              oduserId: userDoc.id,
              displayName: userData.displayName || 'Unknown',
              photoURL: userData.photoURL,
              position: userData.position,
              airline: userData.airline,
            };
          })
      );
      setNearbyCrew(crew);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, filter, city, area]);

  // Get unique airlines from connections
  const availableAirlines = useMemo(() => {
    const airlines = connections
      .map(conn => conn.airline)
      .filter((airline): airline is string => !!airline);
    return [...new Set(airlines)].sort();
  }, [connections]);

  // Filter and search connections
  const filteredConnections = useMemo(() => {
    let filtered = connections;

    // Apply position filter
    if (positionFilter !== 'all') {
      filtered = filtered.filter(conn => conn.position === positionFilter);
    }

    // Apply airline filter
    if (airlineFilter !== 'all') {
      filtered = filtered.filter(conn => conn.airline === airlineFilter);
    }

    // Apply search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(conn => 
        conn.displayName.toLowerCase().includes(q) ||
        conn.airline?.toLowerCase().includes(q)
      );
    }

    // Apply sort
    switch (sortOption) {
      case 'a-z':
        return filtered.sort((a, b) => a.displayName.localeCompare(b.displayName));
      case 'z-a':
        return filtered.sort((a, b) => b.displayName.localeCompare(a.displayName));
      case 'recent':
        return filtered; // Already in order from Firestore (most recent first if we add createdAt)
      default:
        return filtered;
    }
  }, [connections, positionFilter, airlineFilter, searchQuery, sortOption]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (positionFilter !== 'all') count++;
    if (airlineFilter !== 'all') count++;
    if (sortOption !== 'a-z') count++;
    return count;
  }, [positionFilter, airlineFilter, sortOption]);

  const clearAllFilters = () => {
    setPositionFilter('all');
    setAirlineFilter('all');
    setSortOption('a-z');
    setSearchQuery('');
  };

  const handleAccept = async (request: ConnectionRequest) => {
    try {
      // First check if connection already exists
      const existingConnectionQuery = query(
        collection(db, 'connections'),
        where('userIds', 'array-contains', user!.uid)
      );
      
      const existingConnections = await getDocs(existingConnectionQuery);
      const alreadyConnected = existingConnections.docs.some(doc => {
        const data = doc.data();
        return data.userIds.includes(request.fromUserId);
      });
      
      if (alreadyConnected) {
        // Already connected - just remove the request
        setIncomingRequests(prev => prev.filter(r => r.id !== request.id));
        
        try {
          await deleteDoc(doc(db, 'connectionRequests', request.id));
        } catch (deleteError) {
          console.error('Error deleting duplicate request:', deleteError);
        }
        
        return;
      }
      
      // Create the connection
      const connectionData = {
        userIds: [request.fromUserId, request.toUserId],
        userNames: {
          [request.fromUserId]: request.fromUserName,
          [request.toUserId]: request.toUserName,
        },
        createdAt: serverTimestamp(),
      };
      
      await addDoc(collection(db, 'connections'), connectionData);
      
      
      // Notify the original requester that their connection was accepted
      await notifyConnectionAccepted(
        request.fromUserId,
        request.toUserId,
        request.toUserName
      );
      // Immediately remove from UI for better UX
      setIncomingRequests(prev => prev.filter(r => r.id !== request.id));
      
      // Then delete the request from Firestore
      try {
        await deleteDoc(doc(db, 'connectionRequests', request.id));
      } catch (deleteError) {
        console.error('Error deleting connection request:', deleteError);
      }
      
      Alert.alert('Success!', `You're now connected!`);
    } catch (error: any) {
      console.error('Error accepting connection:', error);
      Alert.alert('Error', `Failed to accept connection: ${error.message || 'Unknown error'}`);
    }
  };

  const handleDecline = async (requestId: string) => {
    // Immediately remove from UI
    setIncomingRequests(prev => prev.filter(r => r.id !== requestId));
    setOutgoingRequests(prev => prev.filter(r => r.id !== requestId));
    
    try {
      await deleteDoc(doc(db, 'connectionRequests', requestId));
    } catch (error) {
      console.error('Error declining request:', error);
    }
  };

  // Use connection ID directly for chat
  const handleOpenChat = async (connection: Connection) => {
    if (!user?.uid) return;
    
    try {
      const connectionId = connection.id;
      
      // Initialize lastMessage fields if they don't exist
      const connectionRef = doc(db, 'connections', connectionId);
      const connectionSnap = await getDoc(connectionRef);
      
      if (connectionSnap.exists()) {
        const data = connectionSnap.data();
        if (!data.lastMessage && data.lastMessage !== '') {
          await updateDoc(connectionRef, {
            lastMessage: '',
            lastMessageTime: serverTimestamp(),
            unreadCount: {
              [user.uid]: 0,
              [connection.oduserId]: 0,
            },
          });
        }
      }
      
      // Navigate to chat using connection ID
      router.push({
        pathname: '/chat/[id]',
        params: { 
          id: connectionId, 
          name: connection.displayName,
        }
      });
    } catch (error) {
      console.error('Error opening chat:', error);
      Alert.alert('Error', 'Failed to open chat. Please try again.');
    }
  };

  const handleDeleteConnection = (connection: Connection) => {
    Alert.alert(
      'Remove Connection',
      `Are you sure you want to remove ${connection.displayName} from your connections?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'connections', connection.id));
            } catch (error) {
              console.error('Error removing connection:', error);
              Alert.alert('Error', 'Failed to remove connection.');
            }
          },
        },
      ]
    );
  };

  const getPositionLabel = (position?: string) => {
    switch (position) {
      case 'Flight Attendant': return 'FA';
      case 'First Officer': return 'FO';
      case 'Captain': return 'Capt';
      default: return '';
    }
  };

  const getPositionFilterLabel = (filter: PositionFilter) => {
    switch (filter) {
      case 'all': return 'All Positions';
      case 'Flight Attendant': return 'Flight Attendants';
      case 'First Officer': return 'First Officers';
      case 'Captain': return 'Captains';
    }
  };

  const getSortLabel = (sort: SortOption) => {
    switch (sort) {
      case 'a-z': return 'A → Z';
      case 'z-a': return 'Z → A';
      case 'recent': return 'Recently Added';
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </ThemedView>
    );
  }

  return (
    <ScrollView style={styles.scrollContainer}>
      <ThemedView style={styles.container}>
        {/* Header */}
        <View style={styles.titleContainer}>
          <ThemedText style={styles.title}>Connections</ThemedText>
        </View>

        {/* Filter Badge - Show when coming from stats */}
        {filter && city && (
          <View style={styles.filterBadge}>
            <Ionicons name="location" size={16} color={Colors.primary} />
            <ThemedText style={styles.filterBadgeText}>
              {filter === 'area' && area 
                ? `Crew in ${area}, ${city}` 
                : `Crew in ${city}`}
            </ThemedText>
            <TouchableOpacity 
              onPress={() => {
                router.setParams({ filter: undefined, city: undefined, area: undefined });
                setActiveTab('connections');
              }}
              style={styles.clearFilterButton}
            >
              <Ionicons name="close-circle" size={18} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'connections' && styles.activeTab]}
            onPress={() => setActiveTab('connections')}
          >
            <ThemedText style={[styles.tabText, activeTab === 'connections' && styles.activeTabText]}>
              My Connections
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'nearby' && styles.activeTab]}
            onPress={() => setActiveTab('nearby')}
          >
            <ThemedText style={[styles.tabText, activeTab === 'nearby' && styles.activeTabText]}>
              Nearby Crew
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* My Connections Tab */}
        {activeTab === 'connections' && (
        <>
        {/* New Requests Section - Always Visible */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>
            📬 New Requests ({incomingRequests.length})
          </ThemedText>
          
          {incomingRequests.length > 0 ? (
            incomingRequests.map((request) => (
              <View key={request.id} style={styles.requestCard}>
                <View style={styles.requestInfo}>
                  {request.photoURL ? (
                    <Image 
                      source={{ uri: request.photoURL }} 
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <ThemedText style={styles.avatarText}>
                        {request.fromUserName.slice(0, 2).toUpperCase()}
                      </ThemedText>
                    </View>
                  )}
                  <View style={styles.requestDetails}>
                    <ThemedText style={styles.requestName}>
                      {request.fromUserName}
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.requestActions}>
                  <TouchableOpacity 
                    style={styles.acceptButton}
                    onPress={() => handleAccept(request)}
                  >
                    <ThemedText style={styles.acceptButtonText}>Accept</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.declineButton}
                    onPress={() => handleDecline(request.id)}
                  >
                    <ThemedText style={styles.declineButtonText}>Decline</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptySection}>
              <ThemedText style={styles.emptySectionText}>
                No new requests
              </ThemedText>
            </View>
          )}
        </View>

        {/* Pending Requests Section - Always Visible */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>
            📤 Pending ({outgoingRequests.length})
          </ThemedText>
          
          {outgoingRequests.length > 0 ? (
            outgoingRequests.map((request) => (
              <View key={request.id} style={styles.pendingCard}>
                <View style={styles.avatarFallback}>
                  <ThemedText style={styles.avatarText}>
                    {request.toUserName.slice(0, 2).toUpperCase()}
                  </ThemedText>
                </View>
                <View style={styles.requestDetails}>
                  <ThemedText style={styles.pendingName}>
                    {request.toUserName}
                  </ThemedText>
                  <ThemedText style={styles.pendingStatus}>
                    Waiting for response
                  </ThemedText>
                </View>
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={() => handleDecline(request.id)}
                >
                  <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <View style={styles.emptySection}>
              <ThemedText style={styles.emptySectionText}>
                No pending requests
              </ThemedText>
            </View>
          )}
        </View>

        {/* Your Crew Section - Always Visible */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>
              ✈️ Your Crew ({connections.length})
            </ThemedText>
            {activeFilterCount > 0 && (
              <TouchableOpacity onPress={clearAllFilters}>
                <ThemedText style={styles.clearFilters}>Clear All</ThemedText>
              </TouchableOpacity>
            )}
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={Colors.text.secondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or airline..."
              placeholderTextColor={Colors.text.secondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={Colors.text.secondary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={[styles.filterButton, activeFilterCount > 0 && styles.filterButtonActive]}
              onPress={() => setShowFilterModal(true)}
            >
              <Ionicons 
                name="options-outline" 
                size={20} 
                color={activeFilterCount > 0 ? Colors.white : Colors.text.secondary} 
              />
              {activeFilterCount > 0 && (
                <View style={styles.filterBadge}>
                  <ThemedText style={styles.filterBadgeText}>{activeFilterCount}</ThemedText>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Quick Position Filter Chips */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.filterContainer}
            contentContainerStyle={styles.filterContent}
          >
            {(['all', 'Flight Attendant', 'First Officer', 'Captain'] as PositionFilter[]).map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.filterChip,
                  positionFilter === filter && styles.filterChipActive
                ]}
                onPress={() => setPositionFilter(filter)}
              >
                <ThemedText style={[
                  styles.filterChipText,
                  positionFilter === filter && styles.filterChipTextActive
                ]}>
                  {filter === 'all' ? 'All' : filter === 'Flight Attendant' ? 'FAs' : filter === 'First Officer' ? 'FOs' : 'Captains'}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </ScrollView>
          
          {/* Active Filters Display */}
          {(airlineFilter !== 'all' || sortOption !== 'a-z') && (
            <View style={styles.activeFiltersRow}>
              {airlineFilter !== 'all' && (
                <View style={styles.activeFilterTag}>
                  <ThemedText style={styles.activeFilterText}>{airlineFilter}</ThemedText>
                  <TouchableOpacity onPress={() => setAirlineFilter('all')}>
                    <Ionicons name="close" size={16} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
              )}
              {sortOption !== 'a-z' && (
                <View style={styles.activeFilterTag}>
                  <ThemedText style={styles.activeFilterText}>{getSortLabel(sortOption)}</ThemedText>
                  <TouchableOpacity onPress={() => setSortOption('a-z')}>
                    <Ionicons name="close" size={16} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
          
          {/* Connections List */}
          {filteredConnections.length > 0 ? (
            filteredConnections.map((connection) => (
              <View key={connection.id} style={styles.connectionCard}>
                <TouchableOpacity 
                  style={styles.connectionMain}
                  onPress={() => handleOpenChat(connection)}
                >
                  <View style={styles.avatarContainer}>
                    {connection.photoURL ? (
                      <Image 
                        source={{ uri: connection.photoURL }} 
                        style={styles.avatar}
                      />
                    ) : (
                      <View style={styles.avatarFallback}>
                        <ThemedText style={styles.avatarText}>
                          {connection.displayName.slice(0, 2).toUpperCase()}
                        </ThemedText>
                      </View>
                    )}
                  </View>
                  
                  <View style={styles.connectionInfo}>
                    <ThemedText style={styles.connectionName}>
                      {connection.displayName}
                    </ThemedText>
                    <View style={styles.connectionMeta}>
                      {connection.position && (
                        <View style={styles.positionBadge}>
                          <ThemedText style={styles.positionText}>
                            {getPositionLabel(connection.position)}
                          </ThemedText>
                        </View>
                      )}
                      {connection.airline && (
                        <ThemedText style={styles.airlineText}>
                          {connection.airline}
                        </ThemedText>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Delete button */}
                <TouchableOpacity 
                  style={styles.deleteButton}
                  onPress={() => handleDeleteConnection(connection)}
                >
                  <Ionicons name="trash-outline" size={20} color={Colors.error} />
                </TouchableOpacity>
              </View>
            ))
          ) : connections.length > 0 ? (
            <View style={styles.emptySection}>
              <ThemedText style={styles.emptySectionText}>
                No matches found
              </ThemedText>
            </View>
          ) : (
            <View style={styles.emptySection}>
              <Ionicons name="people-outline" size={40} color={Colors.text.secondary} />
              <ThemedText style={styles.emptySectionText}>
                No connections yet
              </ThemedText>
              <ThemedText style={styles.emptySectionHint}>
                Find crew on the My Layover tab!
              </ThemedText>
            </View>
          )}
        </View>
        </>
        )}

        {/* Nearby Crew Tab */}
        {activeTab === 'nearby' && (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>
              👋 Discoverable Crew
            </ThemedText>
            
            {loading ? (
              <View style={styles.emptySection}>
                <ActivityIndicator size="large" color={Colors.primary} />
              </View>
            ) : nearbyCrew.length > 0 ? (
              nearbyCrew.map((crew) => (
                <TouchableOpacity 
                  key={crew.id}
                  style={styles.connectionCard}
                  onPress={() => router.push(`/profile/${crew.oduserId}`)}
                >
                  <View style={styles.connectionInfo}>
                    {crew.photoURL ? (
                      <Image 
                        source={{ uri: crew.photoURL }} 
                        style={styles.avatar}
                      />
                    ) : (
                      <View style={styles.avatarFallback}>
                        <ThemedText style={styles.avatarText}>
                          {crew.displayName.slice(0, 2).toUpperCase()}
                        </ThemedText>
                      </View>
                    )}
                    <View style={styles.connectionDetails}>
                      <ThemedText style={styles.connectionName}>
                        {crew.displayName}
                      </ThemedText>
                      {crew.position && (
                        <View style={styles.positionContainer}>
                          <ThemedText style={styles.positionText}>
                            {crew.position}
                          </ThemedText>
                        </View>
                      )}
                      {crew.airline && (
                        <ThemedText style={styles.airlineText}>
                          {crew.airline}
                        </ThemedText>
                      )}
                    </View>
                  </View>
                  <Ionicons 
                    name="chevron-forward" 
                    size={20} 
                    color={Colors.text.secondary} 
                  />
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptySection}>
                <ThemedText style={styles.emptySectionText}>
                  No crew members discoverable right now
                </ThemedText>
                <ThemedText style={styles.emptySectionHint}>
                  {filter === 'area' 
                    ? `No crew are live and discoverable in ${area} at this time`
                    : `No crew are live and discoverable in ${city} at this time`}
                </ThemedText>
              </View>
            )}
          </View>
        )}

      <Modal
        visible={showFilterModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Filter & Sort</ThemedText>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Ionicons name="close" size={24} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Position Filter */}
              <View style={styles.filterSection}>
                <ThemedText style={styles.filterSectionTitle}>Position</ThemedText>
                {(['all', 'Flight Attendant', 'First Officer', 'Captain'] as PositionFilter[]).map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={styles.filterOption}
                    onPress={() => setPositionFilter(option)}
                  >
                    <ThemedText style={styles.filterOptionText}>
                      {getPositionFilterLabel(option)}
                    </ThemedText>
                    {positionFilter === option && (
                      <Ionicons name="checkmark" size={20} color={Colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Airline Filter */}
              {availableAirlines.length > 0 && (
                <View style={styles.filterSection}>
                  <ThemedText style={styles.filterSectionTitle}>Airline</ThemedText>
                  <TouchableOpacity
                    style={styles.filterOption}
                    onPress={() => setAirlineFilter('all')}
                  >
                    <ThemedText style={styles.filterOptionText}>All Airlines</ThemedText>
                    {airlineFilter === 'all' && (
                      <Ionicons name="checkmark" size={20} color={Colors.primary} />
                    )}
                  </TouchableOpacity>
                  {availableAirlines.map((airline) => (
                    <TouchableOpacity
                      key={airline}
                      style={styles.filterOption}
                      onPress={() => setAirlineFilter(airline)}
                    >
                      <ThemedText style={styles.filterOptionText}>{airline}</ThemedText>
                      {airlineFilter === airline && (
                        <Ionicons name="checkmark" size={20} color={Colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Sort Options */}
              <View style={styles.filterSection}>
                <ThemedText style={styles.filterSectionTitle}>Sort By</ThemedText>
                {(['a-z', 'z-a', 'recent'] as SortOption[]).map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={styles.filterOption}
                    onPress={() => setSortOption(option)}
                  >
                    <ThemedText style={styles.filterOptionText}>
                      {getSortLabel(option)}
                    </ThemedText>
                    {sortOption === option && (
                      <Ionicons name="checkmark" size={20} color={Colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => {
                  clearAllFilters();
                  setShowFilterModal(false);
                }}
              >
                <ThemedText style={styles.clearButtonText}>Clear All</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.applyButton}
                onPress={() => setShowFilterModal(false)}
              >
                <ThemedText style={styles.applyButtonText}>Apply</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { 
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: { 
    flex: 1, 
    padding: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
  },
  title: {
    fontSize: 25,
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 25,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  clearFilters: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
  emptySection: {
    padding: 20,
    backgroundColor: Colors.card,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  emptySectionText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 8,
  },
  emptySectionHint: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  requestCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pendingCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  requestInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  requestDetails: {
    flex: 1,
    marginLeft: 12,
  },
  requestName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  pendingName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  pendingStatus: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 10,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: Colors.success,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: Colors.white,
    fontWeight: '600',
  },
  declineButton: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  declineButtonText: {
    color: Colors.text.secondary,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: Colors.error,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cancelButtonText: {
    color: Colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    fontSize: 16,
    color: Colors.text.primary,
  },
  filterButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: Colors.background,
    marginLeft: 8,
  },
  filterButtonActive: {
    backgroundColor: Colors.primary,
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.error,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.white,
  },
  activeFiltersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  activeFilterTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary + '20',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  activeFilterText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
  },
  filterContainer: {
    marginBottom: 12,
  },
  filterContent: {
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  filterChipTextActive: {
    color: Colors.white,
  },
  connectionCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  connectionMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarFallback: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.white,
  },
  connectionInfo: {
    flex: 1,
  },
  connectionName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  connectionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  positionBadge: {
    backgroundColor: Colors.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  positionText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  airlineText: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  modalBody: {
    padding: 20,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterOptionText: {
    fontSize: 16,
    color: Colors.text.primary,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  clearButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  applyButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: Colors.primary,
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  filterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  filterBadgeText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  clearFilterButton: {
    padding: 4,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  activeTabText: {
    color: Colors.primary,
  },
});
