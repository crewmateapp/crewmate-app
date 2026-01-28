/**
 * Skyline Manager Component
 * Admin interface to add skylines for bases that need them
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { db } from '@/config/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';

interface SkylineManagerProps {
  baseCode: string;
  cityName?: string;
  userCount: number;
  users: { id: string; name: string; email: string }[];
  onComplete?: () => void;
}

export function SkylineManager({ baseCode, cityName, userCount, users, onComplete }: SkylineManagerProps) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [formData, setFormData] = useState({
    cityName: cityName || '',
    state: '',
    imageUrl: '',
    airlines: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!formData.cityName || !formData.imageUrl) {
      Alert.alert('Missing Info', 'City name and Image URL are required');
      return;
    }

    // Validate URL
    if (!formData.imageUrl.startsWith('http')) {
      Alert.alert('Invalid URL', 'Please enter a valid image URL starting with http:// or https://');
      return;
    }

    Alert.alert(
      'Confirm',
      `Add skyline for ${baseCode} (${formData.cityName})?\n\nThis will make the skyline visible for ${userCount} user${userCount !== 1 ? 's' : ''}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add Skyline',
          onPress: async () => {
            setSaving(true);
            try {
              const airlines = formData.airlines
                .split(',')
                .map(a => a.trim())
                .filter(Boolean);

              await setDoc(doc(db, 'baseSkylines', baseCode), {
                code: baseCode,
                city: formData.cityName,
                state: formData.state,
                imageUrl: formData.imageUrl,
                airlines: airlines,
                addedAt: new Date(),
                addedBy: user?.uid || 'admin'
              });

              Alert.alert('Success! 🎉', `Skyline added for ${baseCode}. Users will see it immediately!`);
              setExpanded(false);
              setFormData({ cityName: '', state: '', imageUrl: '', airlines: '' });
              onComplete?.();
            } catch (error: any) {
              console.error('Error saving skyline:', error);
              Alert.alert('Error', error.message || 'Failed to save skyline');
            } finally {
              setSaving(false);
            }
          }
        }
      ]
    );
  };

  const openUnsplash = () => {
    const searchQuery = formData.cityName || baseCode;
    const url = `https://unsplash.com/s/photos/${encodeURIComponent(searchQuery)}-skyline`;
    Linking.openURL(url);
  };

  if (!expanded) {
    return (
      <View style={styles.collapsedCard}>
        <View style={styles.collapsedHeader}>
          <View style={styles.collapsedInfo}>
            <Text style={styles.baseCode}>{baseCode}</Text>
            {cityName && <Text style={styles.cityHint}>{cityName}</Text>}
            <Text style={styles.userCount}>
              {userCount} user{userCount !== 1 ? 's' : ''} waiting
            </Text>
          </View>
          <TouchableOpacity
            style={styles.expandButton}
            onPress={() => {
              setFormData({ ...formData, cityName: cityName || '' });
              setExpanded(true);
            }}
          >
            <Ionicons name="add-circle" size={24} color={Colors.primary} />
            <Text style={styles.expandButtonText}>Add Skyline</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.expandedCard}>
      <View style={styles.expandedHeader}>
        <View>
          <Text style={styles.baseCodeLarge}>{baseCode}</Text>
          <Text style={styles.userCountLarge}>
            {userCount} user{userCount !== 1 ? 's' : ''}: {users.map(u => u.name).join(', ')}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setExpanded(false)}>
          <Ionicons name="close-circle" size={28} color={Colors.text.secondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.instructions}>
        <Text style={styles.instructionsTitle}>📸 How to add a skyline:</Text>
        <Text style={styles.instructionsText}>
          1. Tap "Search Unsplash" below{'\n'}
          2. Find a good skyline photo{'\n'}
          3. Right-click → "Copy image address"{'\n'}
          4. Paste URL below
        </Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>City Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., Dallas"
          value={formData.cityName}
          onChangeText={(text) => setFormData({ ...formData, cityName: text })}
          autoCapitalize="words"
        />

        <Text style={styles.label}>State (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., TX"
          value={formData.state}
          onChangeText={(text) => setFormData({ ...formData, state: text })}
          autoCapitalize="characters"
          maxLength={2}
        />

        <View style={styles.urlRow}>
          <View style={styles.urlInputContainer}>
            <Text style={styles.label}>Skyline Image URL *</Text>
            <TextInput
              style={styles.input}
              placeholder="https://images.unsplash.com/..."
              value={formData.imageUrl}
              onChangeText={(text) => setFormData({ ...formData, imageUrl: text })}
              autoCapitalize="none"
              autoCorrect={false}
              multiline
            />
          </View>
          <TouchableOpacity style={styles.unsplashButton} onPress={openUnsplash}>
            <Ionicons name="search" size={20} color={Colors.white} />
            <Text style={styles.unsplashButtonText}>Search{'\n'}Unsplash</Text>
          </TouchableOpacity>
        </View>

        {formData.imageUrl && formData.imageUrl.startsWith('http') && (
          <View style={styles.previewContainer}>
            <Text style={styles.label}>Preview:</Text>
            <Image
              source={{ uri: formData.imageUrl }}
              style={styles.preview}
              resizeMode="cover"
            />
          </View>
        )}

        <Text style={styles.label}>Airlines (optional, comma-separated)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., American Airlines, Delta"
          value={formData.airlines}
          onChangeText={(text) => setFormData({ ...formData, airlines: text })}
          autoCapitalize="words"
        />

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => setExpanded(false)}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Ionicons name="checkmark-circle" size={20} color={Colors.white} />
            <Text style={styles.saveButtonText}>
              {saving ? 'Saving...' : 'Add Skyline'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  collapsedCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  collapsedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  collapsedInfo: {
    flex: 1,
  },
  baseCode: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  cityHint: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  userCount: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 4,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.primary + '15',
  },
  expandButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  expandedCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  expandedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  baseCodeLarge: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  userCountLarge: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  instructions: {
    backgroundColor: Colors.primary + '10',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 6,
  },
  instructionsText: {
    fontSize: 12,
    color: Colors.text.secondary,
    lineHeight: 18,
  },
  form: {
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: Colors.text.primary,
  },
  urlRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-end',
  },
  urlInputContainer: {
    flex: 1,
  },
  unsplashButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  unsplashButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.white,
    textAlign: 'center',
  },
  previewContainer: {
    marginTop: 8,
  },
  preview: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    backgroundColor: Colors.background,
    marginTop: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: Colors.background,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  saveButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: Colors.primary,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
