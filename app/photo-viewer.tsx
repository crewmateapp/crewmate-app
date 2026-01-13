// app/photo-viewer.tsx
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Platform,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type PhotoData = {
  url: string;
  title?: string;
  description?: string;
  uploadedBy?: string;
  uploadedByName?: string;
};

export default function PhotoViewerScreen() {
  const { photos, initialIndex } = useLocalSearchParams<{ 
    photos: string; 
    initialIndex: string;
  }>();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [parsedPhotos, setParsedPhotos] = useState<PhotoData[]>([]);
  const [showDetails, setShowDetails] = useState(true);
  const flatListRef = useRef<FlatList>(null);
  const detailsOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (photos) {
      try {
        const photoData = JSON.parse(photos);
        console.log('📸 Photo viewer received:', photoData);
        
        // Handle both old format (array of strings) and new format (array of objects)
        // Router has already decoded the URL once - use it as-is!
        const formatted: PhotoData[] = Array.isArray(photoData) 
          ? photoData.map(item => {
              if (typeof item === 'string') {
                return { url: item }; // Use as-is
              } else {
                return item; // Use as-is
              }
            })
          : [];
        
        console.log('📸 Formatted photos:', formatted);
        setParsedPhotos(formatted);
        
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

  const toggleDetails = () => {
    const toValue = showDetails ? 0 : 1;
    setShowDetails(!showDetails);
    
    Animated.timing(detailsOpacity, {
      toValue,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      flatListRef.current?.scrollToIndex({ index: currentIndex - 1, animated: true });
    }
  };

  const goToNext = () => {
    if (currentIndex < parsedPhotos.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    }
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

  const currentPhoto = parsedPhotos[currentIndex];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Close Button */}
      <Animated.View style={{ opacity: detailsOpacity, position: 'absolute', zIndex: 100, left: 16, top: insets.top + 10 }}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => {
            console.log('📸 Close button pressed');
            router.back();
          }}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={28} color={Colors.white} />
        </TouchableOpacity>
      </Animated.View>

      {/* Photo Counter */}
      <Animated.View style={{ opacity: detailsOpacity, position: 'absolute', zIndex: 100, alignSelf: 'center', top: insets.top + 16 }}>
        <View style={styles.counter}>
          <ThemedText style={styles.counterText}>
            {currentIndex + 1} / {parsedPhotos.length}
          </ThemedText>
        </View>
      </Animated.View>

      {/* Photo Gallery */}
      <TouchableOpacity 
        activeOpacity={1} 
        onPress={toggleDetails}
        style={{ flex: 1 }}
      >
        <FlatList
          ref={flatListRef}
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
          keyExtractor={(item, index) => `${item.url}-${index}`}
          renderItem={({ item }) => {
            console.log('📸 Rendering image with URL:', item.url);
            return (
              <View style={styles.imageContainer}>
                <Image
                  source={{ uri: item.url }}
                  style={styles.image}
                  resizeMode="contain"
                  onError={(error) => console.error('📸 Image load error:', error.nativeEvent)}
                  onLoad={() => console.log('📸 Image loaded successfully:', item.url)}
                />
              </View>
            );
          }}
        />
      </TouchableOpacity>

      {/* Navigation Arrows */}
      {parsedPhotos.length > 1 && (
        <Animated.View style={{ opacity: detailsOpacity, position: 'absolute', zIndex: 100, top: '50%', left: 0, right: 0 }}>
          {/* Previous Arrow */}
          {currentIndex > 0 && (
            <TouchableOpacity
              style={[styles.arrowButton, styles.arrowLeft]}
              onPress={goToPrevious}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={32} color={Colors.white} />
            </TouchableOpacity>
          )}

          {/* Next Arrow */}
          {currentIndex < parsedPhotos.length - 1 && (
            <TouchableOpacity
              style={[styles.arrowButton, styles.arrowRight]}
              onPress={goToNext}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-forward" size={32} color={Colors.white} />
            </TouchableOpacity>
          )}
        </Animated.View>
      )}

      {/* Photo Details Overlay */}
      {(currentPhoto.title || currentPhoto.description || currentPhoto.uploadedByName) && (
        <Animated.View 
          style={[
            styles.detailsOverlay, 
            { bottom: insets.bottom + 20, opacity: detailsOpacity }
          ]}
        >
          {currentPhoto.title && (
            <ThemedText style={styles.photoTitle}>{currentPhoto.title}</ThemedText>
          )}
          {currentPhoto.description && (
            <ThemedText style={styles.photoDescription}>{currentPhoto.description}</ThemedText>
          )}
          {currentPhoto.uploadedByName && (
            <View style={styles.photographerRow}>
              <Ionicons name="person-circle-outline" size={16} color={Colors.white} />
              <ThemedText style={styles.photographerText}>
                Photo by {currentPhoto.uploadedByName}
              </ThemedText>
            </View>
          )}
        </Animated.View>
      )}

      {/* Dots Indicator */}
      {parsedPhotos.length > 1 && parsedPhotos.length <= 10 && (
        <Animated.View 
          style={[
            styles.dotsContainer, 
            { 
              bottom: (currentPhoto.title || currentPhoto.description || currentPhoto.uploadedByName) 
                ? insets.bottom + 140 
                : insets.bottom + 30,
              opacity: detailsOpacity 
            }
          ]}
        >
          {parsedPhotos.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                currentIndex === index && styles.dotActive,
              ]}
            />
          ))}
        </Animated.View>
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
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 22,
  },
  counter: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
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
  arrowButton: {
    position: 'absolute',
    padding: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 26,
  },
  arrowLeft: {
    left: 16,
  },
  arrowRight: {
    right: 16,
  },
  detailsOverlay: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  photoTitle: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  photoDescription: {
    color: Colors.white,
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.9,
  },
  photographerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  photographerText: {
    color: Colors.white,
    fontSize: 12,
    opacity: 0.8,
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
