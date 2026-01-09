// app/photo-viewer.tsx
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Platform,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function PhotoViewerScreen() {
  const { photos, initialIndex } = useLocalSearchParams<{ 
    photos: string; 
    initialIndex: string;
  }>();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [parsedPhotos, setParsedPhotos] = useState<string[]>([]);

  useEffect(() => {
    if (photos) {
      try {
        const photoArray = JSON.parse(photos);
        setParsedPhotos(photoArray);
        
        // Set initial index
        if (initialIndex) {
          setCurrentIndex(parseInt(initialIndex, 10));
        }
      } catch (error) {
        console.error('Error parsing photos:', error);
        setParsedPhotos([]);
      }
    }
  }, [photos, initialIndex]);

  const handleScroll = (event: any) => {
    const slideIndex = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setCurrentIndex(slideIndex);
  };

  if (parsedPhotos.length === 0) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <TouchableOpacity
          style={[styles.closeButton, { top: insets.top + 10 }]}
          onPress={() => router.back()}
        >
          <Ionicons name="close" size={28} color={Colors.white} />
        </TouchableOpacity>
        <View style={styles.errorContainer}>
          <Ionicons name="image-outline" size={64} color={Colors.white} />
          <ThemedText style={styles.errorText}>No photos to display</ThemedText>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Close Button */}
      <TouchableOpacity
        style={[styles.closeButton, { top: insets.top + 10 }]}
        onPress={() => router.back()}
      >
        <Ionicons name="close" size={28} color={Colors.white} />
      </TouchableOpacity>

      {/* Photo Counter */}
      <View style={[styles.counter, { top: insets.top + 16 }]}>
        <ThemedText style={styles.counterText}>
          {currentIndex + 1} / {parsedPhotos.length}
        </ThemedText>
      </View>

      {/* Photo Gallery */}
      <FlatList
        data={parsedPhotos}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        initialScrollIndex={parseInt(initialIndex || '0', 10)}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
        keyExtractor={(item, index) => `${item}-${index}`}
        renderItem={({ item }) => (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: item }}
              style={styles.image}
              resizeMode="contain"
            />
          </View>
        )}
      />

      {/* Dots Indicator */}
      {parsedPhotos.length > 1 && parsedPhotos.length <= 10 && (
        <View style={[styles.dotsContainer, { bottom: insets.bottom + 30 }]}>
          {parsedPhotos.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                currentIndex === index && styles.dotActive,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  closeButton: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
  },
  counter: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  counterText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.8,
  },
  dotsContainer: {
    position: 'absolute',
    flexDirection: 'row',
    alignSelf: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  dotActive: {
    backgroundColor: Colors.white,
    width: 24,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  errorText: {
    color: Colors.white,
    fontSize: 18,
  },
});
