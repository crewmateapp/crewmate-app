import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db, storage } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import {
    addDoc,
    collection,
    doc,
    getDoc,
    serverTimestamp,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export default function CreatePostScreen() {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const pickImage = async () => {
    Alert.alert(
      'Add Photo',
      'Choose where to get your photo from',
      [
        {
          text: 'Take Photo',
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            
            if (status !== 'granted') {
              Alert.alert('Permission Needed', 'Please allow access to your camera.');
              return;
            }

            const result = await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              aspect: [4, 5],
              quality: 0.7,
            });

            if (!result.canceled) {
              setPhotoUri(result.assets[0].uri);
            }
          }
        },
        {
          text: 'Choose from Library',
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            
            if (status !== 'granted') {
              Alert.alert('Permission Needed', 'Please allow access to your photo library.');
              return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              aspect: [4, 5],
              quality: 0.7,
            });

            if (!result.canceled) {
              setPhotoUri(result.assets[0].uri);
            }
          }
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  const uploadPhoto = async (): Promise<string | null> => {
    if (!photoUri || !user) return null;

    try {
      const response = await fetch(photoUri);
      const blob = await response.blob();
      
      const photoRef = ref(storage, `posts/${user.uid}/${Date.now()}.jpg`);
      await uploadBytes(photoRef, blob);
      
      const downloadURL = await getDownloadURL(photoRef);
      return downloadURL;
    } catch (error) {
      console.error('Error uploading photo:', error);
      return null;
    }
  };

  const handlePost = async () => {
    if (!user) return;

    // Validation
    if (!photoUri) {
      Alert.alert('Photo Required', 'Please add a photo for your crewfie.');
      return;
    }

    setUploading(true);

    try {
      // Get user profile data
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();

      // Upload photo
      const photoURL = await uploadPhoto();

      if (!photoURL) {
        throw new Error('Failed to upload photo');
      }

      // Create post
      await addDoc(collection(db, 'posts'), {
        type: 'crewfie',
        userId: user.uid,
        userName: userData?.displayName || 'Unknown',
        userAirline: userData?.airline || 'Unknown',
        userPhoto: userData?.photoURL || null,
        content: content.trim() || null,
        photoURL: photoURL,
        location: userData?.currentLayover?.city || null,
        likes: [],
        createdAt: serverTimestamp(),
      });

      Alert.alert('Posted!', 'Your crewfie has been shared.', [
        {
          text: 'OK',
          onPress: () => router.back()
        }
      ]);
    } catch (error) {
      console.error('Error creating post:', error);
      Alert.alert('Error', 'Failed to create post. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <ThemedView style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <ThemedText style={styles.cancelButton}>Cancel</ThemedText>
            </TouchableOpacity>
            <ThemedText style={styles.title}>Create Crewfie</ThemedText>
            <TouchableOpacity 
              onPress={handlePost}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator color={Colors.primary} />
              ) : (
                <ThemedText style={styles.postButton}>Post</ThemedText>
              )}
            </TouchableOpacity>
          </View>

          {/* Content Input */}
          <View style={styles.contentContainer}>
            <TextInput
              style={styles.contentInput}
              placeholder="What's on your mind?"
              placeholderTextColor={Colors.text.secondary}
              multiline
              value={content}
              onChangeText={setContent}
              maxLength={500}
            />
            <ThemedText style={styles.charCount}>
              {content.length}/500
            </ThemedText>
          </View>

          {/* Photo Section */}
          <View style={styles.photoSection}>
            <TouchableOpacity style={styles.addPhotoButton} onPress={pickImage}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.photoPreview} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="camera-outline" size={48} color={Colors.text.secondary} />
                  <ThemedText style={styles.photoPlaceholderText}>
                    Add Photo
                  </ThemedText>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  cancelButton: {
    color: Colors.text.secondary,
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  postButton: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  contentContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  contentInput: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text.primary,
  },
  charCount: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 8,
    textAlign: 'right',
  },
  photoSection: {
    paddingHorizontal: 20,
  },
  addPhotoButton: {
    width: '100%',
    aspectRatio: 4/5,
    borderRadius: 12,
    overflow: 'hidden',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    borderRadius: 12,
  },
  photoPlaceholderText: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginTop: 8,
  },
});