// components/SimpleCalendar.tsx
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';

interface SimpleCalendarProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  minDate?: Date;
  maxDate?: Date;
}

export function SimpleCalendar({ selectedDate, onSelectDate, minDate, maxDate }: SimpleCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate));

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month, 1).getDay();
  };

  const isDateDisabled = (date: Date) => {
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  };

  const isSameDay = (date1: Date, date2: Date) => {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  };

  const previousMonth = () => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() - 1);
    setCurrentMonth(newMonth);
  };

  const nextMonth = () => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + 1);
    setCurrentMonth(newMonth);
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);
    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(<View key={`empty-${i}`} style={styles.dayCell} />);
    }

    // Add cells for each day of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      const isSelected = isSameDay(date, selectedDate);
      const isDisabled = isDateDisabled(date);
      const isToday = isSameDay(date, new Date());

      days.push(
        <TouchableOpacity
          key={day}
          style={[
            styles.dayCell,
            isSelected && styles.selectedDay,
            isDisabled && styles.disabledDay,
          ]}
          onPress={() => !isDisabled && onSelectDate(date)}
          disabled={isDisabled}
        >
          <ThemedText
            style={[
              styles.dayText,
              isSelected && styles.selectedDayText,
              isDisabled && styles.disabledDayText,
              isToday && !isSelected && styles.todayText,
            ]}
          >
            {day}
          </ThemedText>
        </TouchableOpacity>
      );
    }

    return days;
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <View style={styles.container}>
      {/* Month/Year Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={previousMonth} style={styles.navButton}>
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <ThemedText style={styles.monthYear}>
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </ThemedText>
        <TouchableOpacity onPress={nextMonth} style={styles.navButton}>
          <Ionicons name="chevron-forward" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Day Names */}
      <View style={styles.dayNamesRow}>
        {dayNames.map((name) => (
          <View key={name} style={styles.dayNameCell}>
            <ThemedText style={styles.dayName}>{name}</ThemedText>
          </View>
        ))}
      </View>

      {/* Calendar Grid */}
      <View style={styles.calendarGrid}>{renderCalendar()}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background,
    paddingVertical: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  navButton: {
    padding: 8,
  },
  monthYear: {
    fontSize: 18,
    fontWeight: '700',
  },
  dayNamesRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dayNameCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  dayName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 16,
  },
  selectedDay: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
  },
  selectedDayText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  disabledDay: {
    opacity: 0.3,
  },
  disabledDayText: {
    color: Colors.text.secondary,
  },
  todayText: {
    color: Colors.primary,
    fontWeight: '700',
  },
});
