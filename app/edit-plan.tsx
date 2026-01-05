// app/edit-plan.tsx
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

type Plan = {
  id: string;
  title: string;
  spotId: string;
  spotName: string;
  spotAddress: string;
  city: string;
  scheduledTime: any;
  description?: string;
  isPublic: boolean;
  hostUserId: string;
  attendeeIds: string[];
};

export default function EditPlanScreen() {
  const { id: planId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  
  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledTime, setScheduledTime] = useState(new Date());
  const [isPublic, setIsPublic] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Track what changed
  const [changes, setChanges] = useState<string[]>([]);

  useEffect(() => {
    const loadPlan = async () => {
      if (!planId) return;

      try {
        const planDoc = await getDoc(doc(db, 'plans', planId));
        if (planDoc.exists()) {
          const planData = { id: planDoc.id, ...planDoc.data() } as Plan;
          
          // Check if user is the host
          if (planData.hostUserId !== user?.uid) {
            Alert.alert('Error', 'Only the host can edit this plan');
            router.back();
            return;
          }

          setPlan(planData);
          setTitle(planData.title);
          setDescription(planData.description || '');
          setScheduledTime(planData.scheduledTime.toDate());
          setIsPublic(planData.isPublic);
        } else {
          Alert.alert('Error', 'Plan not found');
          router.back();
        }
      } catch (error) {
        console.error('Error loading plan:', error);
        Alert.alert('Error', 'Failed to load plan');
      } finally {
        setLoading(false);
      }
    };

    loadPlan();
  }, [planId, user]);

  const handleSave = async () => {
    if (!plan || !user) return;

    // Validate
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a plan title');
      return;
    }

    // Check what changed
    const changesList: string[] = [];
    if (title !== plan.title) changesList.push('title');
    if (description !== (plan.description || '')) changesList.push('description');
    if (scheduledTime.getTime() !== plan.scheduledTime.toDate().getTime()) changesList.push('time');
    if (isPublic !== plan.isPublic) changesList.push('privacy');

    if (changesList.length === 0) {
      Alert.alert('No Changes', 'You haven\'t made any changes to the plan');
      return;
    }

    setSaving(true);

    try {
      // Update the plan
      await updateDoc(doc(db, 'plans', plan.id), {
        title,
        description,
        scheduledTime,
        isPublic,
        updatedAt: serverTimestamp(),
      });

      // Notify attendees if there are any
      if (plan.attendeeIds.length > 0) {
        const changeText = changesList.map(c => {
          if (c === 'time') return 'meeting time';
          if (c === 'privacy') return isPublic ? 'changed to public' : 'changed to private';
          return c;
        }).join(', ');

        // Create notifications for each attendee
        for (const attendeeId of plan.attendeeIds) {
          await addDoc(collection(db, 'planNotifications'), {
            userId: attendeeId,
            planId: plan.id,
            planTitle: title,
            type: 'plan_updated',
            message: `Plan updated: ${changeText}`,
            changes: changesList,
            read: false,
            createdAt: serverTimestamp(),
          });
        }
      }

      Alert.alert(
        'Plan Updated!',
        plan.attendeeIds.length > 0 
          ? `Your plan has been updated. ${plan.attendeeIds.length} attendee${plan.attendeeIds.length > 1 ? 's' : ''} will be notified.`
          : 'Your plan has been updated.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          }
        ]
      );
    } catch (error) {
      console.error('Error updating plan:', error);
      Alert.alert('Error', 'Failed to update plan. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const newDate = new Date(scheduledTime);
      newDate.setFullYear(selectedDate.getFullYear());
      newDate.setMonth(selectedDate.getMonth());
      newDate.setDate(selectedDate.getDate());
      setScheduledTime(newDate);
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const newDate = new Date(scheduledTime);
      newDate.setHours(selectedTime.getHours());
      newDate.setMinutes(selectedTime.getMinutes());
      setScheduledTime(newDate);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 100 }} />
      </ThemedView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ThemedView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={28} color={Colors.text.primary} />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Edit Plan</ThemedText>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <ThemedText style={styles.saveButton}>Save</ThemedText>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Title */}
          <View style={styles.section}>
            <ThemedText style={styles.label}>Plan Title</ThemedText>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g., Coffee before our flight"
              placeholderTextColor={Colors.text.secondary}
              maxLength={100}
            />
          </View>

          {/* Location (Read-only) */}
          <View style={styles.section}>
            <ThemedText style={styles.label}>Location</ThemedText>
            <View style={styles.readOnlyField}>
              <Ionicons name="location" size={20} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.spotName}>{plan?.spotName}</ThemedText>
                <ThemedText style={styles.spotAddress}>{plan?.spotAddress}</ThemedText>
              </View>
            </View>
            <ThemedText style={styles.helperText}>
              To change location, create a new plan
            </ThemedText>
          </View>

          {/* Date & Time */}
          <View style={styles.section}>
            <ThemedText style={styles.label}>Date & Time</ThemedText>
            
            <TouchableOpacity
              style={styles.dateTimeButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar" size={20} color={Colors.primary} />
              <ThemedText style={styles.dateTimeText}>
                {scheduledTime.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dateTimeButton}
              onPress={() => setShowTimePicker(true)}
            >
              <Ionicons name="time" size={20} color={Colors.primary} />
              <ThemedText style={styles.dateTimeText}>
                {scheduledTime.toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                })}
              </ThemedText>
            </TouchableOpacity>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <ThemedText style={styles.label}>Description (Optional)</ThemedText>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Add any additional details..."
              placeholderTextColor={Colors.text.secondary}
              multiline
              numberOfLines={4}
              maxLength={500}
            />
          </View>

          {/* Privacy Toggle */}
          <View style={styles.section}>
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.label}>Public Plan</ThemedText>
                <ThemedText style={styles.helperText}>
                  {isPublic 
                    ? 'Anyone in your city can see and join this plan'
                    : 'Only people you share the QR code with can join'
                  }
                </ThemedText>
              </View>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                trackColor={{ false: Colors.border, true: Colors.accent }}
                thumbColor={Colors.white}
              />
            </View>
          </View>

          {/* Attendees Info */}
          {plan && plan.attendeeIds.length > 0 && (
            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={20} color={Colors.primary} />
              <ThemedText style={styles.infoText}>
                {plan.attendeeIds.length} attendee{plan.attendeeIds.length > 1 ? 's' : ''} will be notified of any changes
              </ThemedText>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* Date Picker */}
        {showDatePicker && (
          <DateTimePicker
            value={scheduledTime}
            mode="date"
            display="default"
            onChange={handleDateChange}
            minimumDate={new Date()}
          />
        )}

        {/* Time Picker */}
        {showTimePicker && (
          <DateTimePicker
            value={scheduledTime}
            mode="time"
            display="default"
            onChange={handleTimeChange}
          />
        )}
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: Colors.text.primary,
  },
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.text.primary,
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  readOnlyField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 16,
  },
  spotName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  spotAddress: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  helperText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 8,
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  dateTimeText: {
    fontSize: 16,
    color: Colors.text.primary,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: Colors.accent + '20',
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text.primary,
  },
});
