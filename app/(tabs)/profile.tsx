import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db, storage } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { collection, doc, getDoc, limit, onSnapshot, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type UserProfile = {
  firstName: string;
  lastInitial: string;
  displayName: string;
  airline: string;
  base: string;
  bio: string;
  email: string;
  photoURL?: string;
};

type Activity = {
  id: string;
  type: 'spot_added' | 'review_left' | 'photo_posted';
  spotId?: string;
  spotName?: string;
  city?: string;
  rating?: number;
  createdAt: any;
};

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [friendCount, setFriendCount] = useState(0);
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setProfile(userDoc.data() as UserProfile);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  // Listen to friend count
  useEffect(() => {
    if (!user) return;

    const connectionsQuery = query(
      collection(db, 'connections'),
      where('userIds', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(connectionsQuery, (snapshot) => {
      setFriendCount(snapshot.size);
    });

    return () => unsubscribe();
  }, [user]);

  // Listen to recent activities
  useEffect(() => {
    if (!user) return;

    const activitiesQuery = query(
      collection(db, 'activities'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(activitiesQuery, (snapshot) => {
      const activities: Activity[] = [];
      snapshot.docs.forEach(doc => {
        activities.push({
          id: doc.id,
          ...doc.data(),
        } as Activity);
      });
      setRecentActivities(activities);
    });

    return () => unsubscribe();
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      const refreshProfile = async () => {
        if (!user) return;
        
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setProfile(userDoc.data() as UserProfile);
          }
        } catch (error) {
          console.error('Error refreshing profile:', error);
        }
      };

      refreshProfile();
    }, [user])
  );

  const pickAndUploadPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'Please allow access to your photo library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (result.canceled || !user) return;

    setUploadingPhoto(true);
    try {
      const response = await fetch(result.assets[0].uri);
      const blob = await response.blob();
      
      const photoRef = ref(storage, `profilePhotos/${user.uid}.jpg`);
      await uploadBytes(photoRef, blob);
      
      const downloadURL = await getDownloadURL(photoRef);
      
      await updateDoc(doc(db, 'users', user.uid), {
        photoURL: downloadURL
      });

      setProfile(prev => prev ? { ...prev, photoURL: downloadURL } : null);
      
      Alert.alert('Success', 'Profile photo updated!');
    } catch (error) {
      console.error('Error uploading photo:', error);
      Alert.alert('Error', 'Failed to upload photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/auth/signin');
          }
        }
      ]
    );
  };

  const handleSpotPress = (spotId: string) => {
    router.push({
      pathname: '/spot/[id]',
      params: { id: spotId }
    });
  };

  const renderStars = (rating: number) => {
    return '⭐'.repeat(rating);
  };

  const renderActivity = (activity: Activity) => {
    let activityText;
    let icon;
    let iconColor;

    switch (activity.type) {
      case 'spot_added':
        icon = 'add-circle';
        iconColor = Colors.success;
        activityText = (
          <Text style={styles.activityText}>
            {'Added '}
            <Text 
              style={styles.clickableText}
              onPress={() => activity.spotId && handleSpotPress(activity.spotId)}
            >
              {activity.spotName}
            </Text>
            {' in '}
            <Text style={styles.clickableText}>{activity.city}</Text>
          </Text>
        );
        break;
      
      case 'review_left':
        icon = 'star';
        iconColor = Colors.accent;
        activityText = (
          <Text style={styles.activityText}>
            {'Left a '}
            <Text style={styles.stars}>{renderStars(activity.rating || 0)}</Text>
            {' review on '}
            <Text 
              style={styles.clickableText}
              onPress={() => activity.spotId && handleSpotPress(activity.spotId)}
            >
              {activity.spotName}
            </Text>
          </Text>
        );
        break;
      
      case 'photo_posted':
        icon = 'camera';
        iconColor = Colors.primary;
        activityText = (
          <Text style={styles.activityText}>
            {'Posted a photo at '}
            <Text 
              style={styles.clickableText}
              onPress={() => activity.spotId && handleSpotPress(activity.spotId)}
            >
              {activity.spotName}
            </Text>
          </Text>
        );
        break;
    }

    return (
      <View key={activity.id} style={styles.activityItem}>
        <Ionicons name={icon as any} size={18} color={iconColor} />
        <View style={styles.activityTextContainer}>
          {activityText}
        </View>
      </View>
    );
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
        <TouchableOpacity 
          style={styles.qrButton}
          onPress={() => router.push('/qr-code')}
        >
          <Ionicons name="qr-code" size={24} color={Colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.editButton}
          onPress={() => router.push('/edit-profile')}
        >
          <Ionicons name="pencil" size={20} color={Colors.primary} />
          <ThemedText style={styles.editButtonText}>Edit</ThemedText>
        </TouchableOpacity>

        {(user?.email === 'zachary.tillman@aa.com' || user?.email === 'johnny.guzman@aa.com') && (
          <TouchableOpacity
            style={styles.adminButton}
            onPress={() => router.push('/admin')}
          >
            <Ionicons name="shield-checkmark" size={20} color={Colors.white} />
            <ThemedText style={styles.adminButtonText}>Admin Panel</ThemedText>
          </TouchableOpacity>
        )}

        <View style={styles.header}>
          <TouchableOpacity onPress={pickAndUploadPhoto} disabled={uploadingPhoto}>
            {uploadingPhoto ? (
              <View style={styles.avatarFallback}>
                <ActivityIndicator color={Colors.white} />
              </View>
            ) : profile?.photoURL ? (
              <Image source={{ uri: profile.photoURL }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <ThemedText style={styles.avatarText}>
                  {profile?.firstName?.[0]}{profile?.lastInitial}
                </ThemedText>
              </View>
            )}
            <View style={styles.editBadge}>
              <ThemedText style={styles.editBadgeText}>📷</ThemedText>
            </View>
          </TouchableOpacity>

          <ThemedText type="title" style={styles.name}>
            {profile?.displayName}
          </ThemedText>
          <ThemedText style={styles.airline}>
            {profile?.airline}
          </ThemedText>
          <ThemedText style={styles.base}>
            📍 Based in {profile?.base}
          </ThemedText>
        </View>

        {profile?.bio ? (
          <View style={styles.bioContainer}>
            <ThemedText style={styles.bio}>"{profile.bio}"</ThemedText>
          </View>
        ) : null}

        {/* Friends Section */}
        <TouchableOpacity 
          style={styles.friendsSection}
          onPress={() => router.push('/friends')}
        >
          <View style={styles.friendsHeader}>
            <Ionicons name="people" size={20} color={Colors.primary} />
            <ThemedText style={styles.friendsTitle}>Friends</ThemedText>
            <View style={styles.friendsBadge}>
              <ThemedText style={styles.friendsCount}>{friendCount}</ThemedText>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.text.secondary} />
        </TouchableOpacity>

        {/* Recent Activity Section */}
        {recentActivities.length > 0 && (
          <View style={styles.activitySection}>
            <ThemedText style={styles.sectionTitle}>Recent Activity</ThemedText>
            <View style={styles.activityContainer}>
              {recentActivities.map(activity => renderActivity(activity))}
            </View>
          </View>
        )}

        <View style={styles.infoSection}>
          <ThemedText style={styles.sectionTitle}>Account</ThemedText>
          <View style={styles.infoRow}>
            <ThemedText style={styles.infoLabel}>Email</ThemedText>
            <ThemedText style={styles.infoValue}>{profile?.email}</ThemedText>
          </View>
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <ThemedText style={styles.signOutText}>Sign Out</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 80,
    paddingBottom: 40,
  },
  qrButton: {
    position: 'absolute',
    top: 60,
    right: 85,
    padding: 10,
    zIndex: 10,
  },
  editButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    padding: 10,
    zIndex: 10,
  },
  editButtonText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  adminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#9C27B0',
    paddingVertical: 15,
    borderRadius: 12,
    marginTop: 10,
  },
  adminButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 15,
  },
  avatarFallback: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.white,
  },
  editBadge: {
    position: 'absolute',
    bottom: 10,
    right: -5,
    backgroundColor: Colors.white,
    borderRadius: 15,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  editBadgeText: {
    fontSize: 16,
  },
  name: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  airline: {
    fontSize: 18,
    color: Colors.primary,
    marginBottom: 5,
  },
  base: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
  bioContainer: {
    backgroundColor: Colors.background,
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bio: {
    fontSize: 16,
    fontStyle: 'italic',
    textAlign: 'center',
    color: Colors.text.primary,
  },
  friendsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  friendsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  friendsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  friendsBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  friendsCount: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },
  activitySection: {
    marginBottom: 30,
  },
  activityContainer: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    gap: 10,
  },
  activityTextContainer: {
    flex: 1,
  },
  activityText: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.text.primary,
  },
  clickableText: {
    fontWeight: '700',
    color: Colors.primary,
  },
  stars: {
    fontSize: 12,
  },
  infoSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  infoLabel: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
  infoValue: {
    fontSize: 16,
    color: Colors.text.primary,
  },
  signOutButton: {
    backgroundColor: Colors.error,
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 'auto',
  },
  signOutText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});