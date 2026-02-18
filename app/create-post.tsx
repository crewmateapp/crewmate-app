import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db, storage } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { useCallback, useEffect, useRef, useState } from 'react';
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

const DRAFT_KEY = 'crewfie_draft';

type Draft = {
  content: string;
  photoUri: string | null;
  savedAt: number;
};

export default function CreatePostScreen() {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Draft: Load on mount ──────────────────────────────────────────────────

  useEffect(() => {
    loadDraft();
  }, []);

  const loadDraft = async () => {
    try {
      const saved = await AsyncStorage.getItem(DRAFT_KEY);
      if (!saved) return;

      const draft: Draft = JSON.parse(saved);

      // Only restore drafts less than 7 days old
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - draft.savedAt > sevenDays) {
        await AsyncStorage.removeItem(DRAFT_KEY);
        return;
      }

      const hasContent = draft.content?.trim().length > 0;
      const hasPhoto = !!draft.photoUri;

      if (hasContent || hasPhoto) {
        setContent(draft.content || '');
        setPhotoUri(draft.photoUri || null);
        setDraftRestored(true);

        // Auto-hide the draft restored banner after 4 seconds
        setTimeout(() => setDraftRestored(false), 4000);
      }
    } catch (error) {
      console.error('Error loading draft:', error);
    }
  };

  // ─── Draft: Auto-save on changes (debounced) ──────────────────────────────

  const saveDraft = useCallback((text: string, photo: string | null) => {
    // Clear previous pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce: save 500ms after last change
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const hasContent = text.trim().length > 0;
        const hasPhoto = !!photo;

        if (!hasContent && !hasPhoto) {
          // Nothing to save — clear any existing draft
          await AsyncStorage.removeItem(DRAFT_KEY);
          return;
        }

        const draft: Draft = {
          content: text,
          photoUri: photo,
          savedAt: Date.now(),
        };
        await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch (error) {
        console.error('Error saving draft:', error);
      }
    }, 500);
  }, []);

  // Trigger auto-save when content or photo changes
  const handleContentChange = (text: string) => {
    setContent(text);
    saveDraft(text, photoUri);
  };

  const handlePhotoChange = (uri: string | null) => {
    setPhotoUri(uri);
    saveDraft(content, uri);
  };

  // ─── Draft: Clear on successful post ──────────────────────────────────────

  const clearDraft = async () => {
    try {
      await AsyncStorage.removeItem(DRAFT_KEY);
    } catch (error) {
      console.error('Error clearing draft:', error);
    }
  };

  // ─── Cancel with draft prompt ─────────────────────────────────────────────

  const handleCancel = () => {
    const hasContent = content.trim().length > 0;
    const hasPhoto = !!photoUri;

    if (!hasContent && !hasPhoto) {
      router.back();
      return;
    }

    Alert.alert(
      'Save Draft?',
      'Your post will be saved so you can finish it later.',
      [
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            await clearDraft();
            router.back();
          },
        },
        {
          text: 'Save Draft',
          onPress: () => {
            // Draft is already auto-saved, just go back
            router.back();
          },
        },
      ]
    );
  };

  // ─── Discard restored draft ───────────────────────────────────────────────

  const handleDiscardDraft = () => {
    Alert.alert(
      'Discard Draft?',
      'This will clear your saved draft and start fresh.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            setContent('');
            setPhotoUri(null);
            setDraftRestored(false);
            await clearDraft();
          },
        },
      ]
    );
  };

  // ─── Image Picker ─────────────────────────────────────────────────────────

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
              handlePhotoChange(result.assets[0].uri);
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
              handlePhotoChange(result.assets[0].uri);
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

  // ─── Upload & Post ────────────────────────────────────────────────────────

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

      // ✅ Clear draft on successful post
      await clearDraft();

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

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <ThemedView style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleCancel}>
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

          {/* ✅ Draft Restored Banner */}
          {draftRestored && (
            <View style={styles.draftBanner}>
              <View style={styles.draftBannerLeft}>
                <Ionicons name="document-text" size={16} color={Colors.primary} />
                <ThemedText style={styles.draftBannerText}>
                  Draft restored
                </ThemedText>
              </View>
              <TouchableOpacity onPress={handleDiscardDraft}>
                <ThemedText style={styles.draftDiscardText}>Discard</ThemedText>
              </TouchableOpacity>
            </View>
          )}

          {/* Content Input */}
          <View style={styles.contentContainer}>
            <TextInput
              style={styles.contentInput}
              placeholder="What's on your mind?"
              placeholderTextColor={Colors.text.secondary}
              multiline
              value={content}
              onChangeText={handleContentChange}
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
  // ✅ Draft Banner styles
  draftBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.primary + '10',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  draftBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  draftBannerText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  draftDiscardText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.secondary,
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
