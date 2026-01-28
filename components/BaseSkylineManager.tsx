/**
 * Admin Dashboard - Base Skylines Manager
 * 
 * Shows pending bases that need skylines added
 * Allows admin to easily add skyline URLs
 */

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { getPendingBases, addBaseSkyline } from '@/utils/dynamicBaseSkylines';
import { useAuth } from '@/contexts/AuthContext';

interface PendingBase {
  id: string;
  code: string;
  originalBase: string;
  requestCount: number;
  firstRequestedAt: Date;
  lastRequestedAt: Date;
}

export function BaseSkylineManager() {
  const { user } = useAuth();
  const [pendingBases, setPendingBases] = useState<PendingBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingBase, setEditingBase] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    city: '',
    state: '',
    imageUrl: '',
    airlines: '',
  });

  useEffect(() => {
    loadPendingBases();
  }, []);

  const loadPendingBases = async () => {
    setLoading(true);
    const pending = await getPendingBases();
    setPendingBases(pending.sort((a, b) => b.requestCount - a.requestCount));
    setLoading(false);
  };

  const handleSave = async (baseCode: string) => {
    if (!formData.city || !formData.imageUrl) {
      alert('City and Image URL are required');
      return;
    }

    const airlines = formData.airlines
      .split(',')
      .map(a => a.trim())
      .filter(Boolean);

    await addBaseSkyline(
      baseCode,
      formData.city,
      formData.state,
      formData.imageUrl,
      airlines,
      user?.uid || 'admin'
    );

    setEditingBase(null);
    setFormData({ city: '', state: '', imageUrl: '', airlines: '' });
    loadPendingBases();
  };

  const startEditing = (base: PendingBase) => {
    setEditingBase(base.code);
    setFormData({
      city: base.originalBase !== base.code ? base.originalBase : '',
      state: '',
      imageUrl: '',
      airlines: '',
    });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading pending bases...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Base Skylines Manager</Text>
        <Text style={styles.subtitle}>
          {pendingBases.length} base{pendingBases.length !== 1 ? 's' : ''} need skylines
        </Text>
      </View>

      <View style={styles.instructions}>
        <Ionicons name="information-circle" size={20} color={Colors.primary} />
        <Text style={styles.instructionsText}>
          When users register with new bases, they'll appear here. Add a skyline URL to complete setup.
        </Text>
      </View>

      <View style={styles.tips}>
        <Text style={styles.tipsTitle}>💡 Quick Tips:</Text>
        <Text style={styles.tipText}>• Search "CITY skyline" on Unsplash.com</Text>
        <Text style={styles.tipText}>• Right-click image → Copy Image Address</Text>
        <Text style={styles.tipText}>• Add ?w=800&q=80 to URL for optimization</Text>
      </View>

      {pendingBases.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-circle" size={48} color={Colors.success} />
          <Text style={styles.emptyText}>All bases have skylines! 🎉</Text>
        </View>
      ) : (
        pendingBases.map((base) => (
          <View key={base.code} style={styles.baseCard}>
            <View style={styles.baseHeader}>
              <View style={styles.baseInfo}>
                <Text style={styles.baseCode}>{base.code}</Text>
                <Text style={styles.baseOriginal}>{base.originalBase}</Text>
              </View>
              <View style={styles.requestBadge}>
                <Text style={styles.requestCount}>{base.requestCount} requests</Text>
              </View>
            </View>

            {editingBase === base.code ? (
              <View style={styles.form}>
                <TextInput
                  style={styles.input}
                  placeholder="City name (e.g., Charlotte)"
                  value={formData.city}
                  onChangeText={(text) => setFormData({ ...formData, city: text })}
                />

                <TextInput
                  style={styles.input}
                  placeholder="State (e.g., NC)"
                  value={formData.state}
                  onChangeText={(text) => setFormData({ ...formData, state: text })}
                />

                <TextInput
                  style={styles.input}
                  placeholder="Image URL from Unsplash"
                  value={formData.imageUrl}
                  onChangeText={(text) => setFormData({ ...formData, imageUrl: text })}
                  multiline
                />

                {formData.imageUrl && (
                  <Image
                    source={{ uri: formData.imageUrl }}
                    style={styles.preview}
                    resizeMode="cover"
                  />
                )}

                <TextInput
                  style={styles.input}
                  placeholder="Airlines (comma-separated)"
                  value={formData.airlines}
                  onChangeText={(text) => setFormData({ ...formData, airlines: text })}
                />

                <View style={styles.formButtons}>
                  <TouchableOpacity
                    style={[styles.button, styles.cancelButton]}
                    onPress={() => setEditingBase(null)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.button, styles.saveButton]}
                    onPress={() => handleSave(base.code)}
                  >
                    <Ionicons name="checkmark" size={20} color={Colors.white} />
                    <Text style={styles.saveButtonText}>Save Skyline</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => startEditing(base)}
              >
                <Ionicons name="add-circle" size={20} color={Colors.primary} />
                <Text style={styles.addButtonText}>Add Skyline</Text>
              </TouchableOpacity>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  instructions: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    margin: 16,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary + '20',
    gap: 12,
  },
  instructionsText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text.primary,
    lineHeight: 20,
  },
  tips: {
    padding: 16,
    margin: 16,
    marginTop: 0,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tipsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  tipText: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  baseCard: {
    margin: 16,
    marginTop: 0,
    padding: 16,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  baseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  baseInfo: {
    flex: 1,
  },
  baseCode: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  baseOriginal: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  requestBadge: {
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  requestCount: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  form: {
    gap: 12,
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
  preview: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    backgroundColor: Colors.background,
  },
  formButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  cancelButton: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  saveButton: {
    backgroundColor: Colors.primary,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: 40,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginTop: 16,
  },
});
