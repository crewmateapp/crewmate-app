import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db, storage } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, TouchableOpacity, View } from 'react-native';

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

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

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

  // Refetch profile when screen comes into focus (after editing)
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
      
      // Update Firestore
      await updateDoc(doc(db, 'users', user.uid), {
        photoURL: downloadURL
      });

      // Update local state
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

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color="#2196F3" />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Edit Profile Button */}
      <TouchableOpacity 
        style={styles.editButton}
        onPress={() => router.push('/edit-profile')}
      >
        <Ionicons name="pencil" size={20} color="#2196F3" />
        <ThemedText style={styles.editButtonText}>Edit</ThemedText>
      </TouchableOpacity>

      <View style={styles.header}>
        <TouchableOpacity onPress={pickAndUploadPhoto} disabled={uploadingPhoto}>
          {uploadingPhoto ? (
            <View style={styles.avatarFallback}>
              <ActivityIndicator color="#fff" />
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 80,
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
    color: '#2196F3',
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
    backgroundColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  editBadge: {
    position: 'absolute',
    bottom: 10,
    right: -5,
    backgroundColor: '#fff',
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
    color: '#2196F3',
    marginBottom: 5,
  },
  base: {
    fontSize: 16,
    opacity: 0.7,
  },
  bioContainer: {
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    padding: 15,
    borderRadius: 12,
    marginBottom: 30,
  },
  bio: {
    fontSize: 16,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  infoSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.5,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  infoLabel: {
    fontSize: 16,
    opacity: 0.7,
  },
  infoValue: {
    fontSize: 16,
  },
  signOutButton: {
    backgroundColor: '#f44336',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 'auto',
  },
  signOutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});