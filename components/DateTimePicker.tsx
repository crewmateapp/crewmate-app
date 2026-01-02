// components/DateTimePicker.tsx
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
  ScrollView
} from 'react-native';

interface DateTimePickerProps {
  visible: boolean;
  mode: 'date' | 'time';
  value: Date;
  onClose: () => void;
  onSelect: (date: Date) => void;
  minimumDate?: Date;
}

export function DateTimePicker({ 
  visible, 
  mode, 
  value, 
  onClose, 
  onSelect,
  minimumDate 
}: DateTimePickerProps) {
  const [selectedDate, setSelectedDate] = useState(value);

  const handleConfirm = () => {
    onSelect(selectedDate);
    onClose();
  };

  if (mode === 'date') {
    return (
      <DatePickerModal
        visible={visible}
        value={selectedDate}
        onClose={onClose}
        onSelect={handleConfirm}
        onChange={setSelectedDate}
        minimumDate={minimumDate}
      />
    );
  }

  return (
    <TimePickerModal
      visible={visible}
      value={selectedDate}
      onClose={onClose}
      onSelect={handleConfirm}
      onChange={setSelectedDate}
    />
  );
}

// Date Picker Modal
function DatePickerModal({ 
  visible, 
  value, 
  onClose, 
  onSelect, 
  onChange,
  minimumDate 
}: {
  visible: boolean;
  value: Date;
  onClose: () => void;
  onSelect: () => void;
  onChange: (date: Date) => void;
  minimumDate?: Date;
}) {
  const today = minimumDate || new Date();
  const maxDays = 90; // Show next 90 days

  const dates: Date[] = [];
  for (let i = 0; i < maxDays; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    dates.push(date);
  }

  const formatDate = (date: Date) => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const dayName = dayNames[date.getDay()];
    const monthName = monthNames[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();

    return `${dayName}, ${monthName} ${day}, ${year}`;
  };

  const isToday = (date: Date) => {
    const now = new Date();
    return date.toDateString() === now.toDateString();
  };

  const isTomorrow = (date: Date) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return date.toDateString() === tomorrow.toDateString();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose}>
              <ThemedText style={styles.cancelButton}>Cancel</ThemedText>
            </TouchableOpacity>
            <ThemedText style={styles.title}>Select Date</ThemedText>
            <TouchableOpacity onPress={onSelect}>
              <ThemedText style={styles.doneButton}>Done</ThemedText>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.dateList} showsVerticalScrollIndicator={false}>
            {dates.map((date, index) => {
              const isSelected = date.toDateString() === value.toDateString();
              
              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.dateItem, isSelected && styles.dateItemSelected]}
                  onPress={() => onChange(date)}
                >
                  <View style={styles.dateItemContent}>
                    <ThemedText style={[styles.dateText, isSelected && styles.dateTextSelected]}>
                      {formatDate(date)}
                    </ThemedText>
                    {isToday(date) && (
                      <View style={styles.todayBadge}>
                        <ThemedText style={styles.todayText}>Today</ThemedText>
                      </View>
                    )}
                    {isTomorrow(date) && (
                      <View style={styles.tomorrowBadge}>
                        <ThemedText style={styles.tomorrowText}>Tomorrow</ThemedText>
                      </View>
                    )}
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// Time Picker Modal
function TimePickerModal({ 
  visible, 
  value, 
  onClose, 
  onSelect, 
  onChange 
}: {
  visible: boolean;
  value: Date;
  onClose: () => void;
  onSelect: () => void;
  onChange: (date: Date) => void;
}) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = [0, 15, 30, 45];

  const currentHour = value.getHours();
  const currentMinute = value.getMinutes();

  const handleTimeSelect = (hour: number, minute: number) => {
    const newDate = new Date(value);
    newDate.setHours(hour);
    newDate.setMinutes(minute);
    onChange(newDate);
  };

  const formatHour = (hour: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour} ${period}`;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose}>
              <ThemedText style={styles.cancelButton}>Cancel</ThemedText>
            </TouchableOpacity>
            <ThemedText style={styles.title}>Select Time</ThemedText>
            <TouchableOpacity onPress={onSelect}>
              <ThemedText style={styles.doneButton}>Done</ThemedText>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.timeList} showsVerticalScrollIndicator={false}>
            {hours.map((hour) => (
              <View key={hour} style={styles.hourSection}>
                <ThemedText style={styles.hourLabel}>{formatHour(hour)}</ThemedText>
                <View style={styles.minuteRow}>
                  {minutes.map((minute) => {
                    const isSelected = currentHour === hour && currentMinute === minute;
                    return (
                      <TouchableOpacity
                        key={`${hour}-${minute}`}
                        style={[styles.minuteButton, isSelected && styles.minuteButtonSelected]}
                        onPress={() => handleTimeSelect(hour, minute)}
                      >
                        <ThemedText style={[styles.minuteText, isSelected && styles.minuteTextSelected]}>
                          :{minute.toString().padStart(2, '0')}
                        </ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  cancelButton: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
  doneButton: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  dateList: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  dateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: Colors.background,
  },
  dateItemSelected: {
    backgroundColor: Colors.primary + '15',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  dateItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  dateText: {
    fontSize: 16,
    color: Colors.text.primary,
  },
  dateTextSelected: {
    fontWeight: '600',
    color: Colors.primary,
  },
  todayBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  todayText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.white,
  },
  tomorrowBadge: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tomorrowText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  timeList: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  hourSection: {
    marginBottom: 16,
  },
  hourLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  minuteRow: {
    flexDirection: 'row',
    gap: 8,
  },
  minuteButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: Colors.background,
    alignItems: 'center',
  },
  minuteButtonSelected: {
    backgroundColor: Colors.primary,
  },
  minuteText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  minuteTextSelected: {
    color: Colors.white,
  },
});
