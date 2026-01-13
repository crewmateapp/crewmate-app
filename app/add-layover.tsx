// app/add-layover.tsx
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SimpleCalendar } from '@/components/SimpleCalendar';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { useCities } from '@/hooks/useCities';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function AddLayoverScreen() {
  const { user } = useAuth();
  const { cities, loading: citiesLoading } = useCities();
  
  const [city, setCity] = useState('');
  const [area, setArea] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  });
  const [preDiscoverable, setPreDiscoverable] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Search state
  const [citySearchQuery, setCitySearchQuery] = useState('');
  
  // Modal states
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [showAreaPicker, setShowAreaPicker] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  
  const selectedCityData = cities.find((c) => c.name === city);
  
  // Filter cities based on search query
  const filteredCities = useMemo(() => {
    const query = citySearchQuery.trim().toLowerCase();
    if (!query) return cities;
    
    return cities.filter((cityItem) => {
      const matchesName = cityItem.name.toLowerCase().includes(query);
      const matchesCode = cityItem.code?.toLowerCase().includes(query);
      return matchesName || matchesCode;
    });
  }, [citySearchQuery, cities]);
  
  const handleSave = async () => {
    // Validation
    if (!city) {
      Alert.alert('Missing Info', 'Please select a city');
      return;
    }
    if (!area) {
      Alert.alert('Missing Info', 'Please select an area');
      return;
    }
    if (endDate <= startDate) {
      Alert.alert('Invalid Dates', 'End date must be after start date');
      return;
    }
    
    // Check if within 30 days
    const daysUntil = Math.ceil((startDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil > 30) {
      Alert.alert('Too Far Ahead', 'Layovers can only be added up to 30 days in advance');
      return;
    }
    
    if (!user?.uid) {
      Alert.alert('Error', 'You must be signed in');
      return;
    }
    
    setSaving(true);
    try {
      const layover = {
        id: `layover_${Date.now()}`,
        city,
        area,
        startDate,
        endDate,
        status: 'upcoming',
        preDiscoverable,
        createdAt: new Date(),
      };
      
      await updateDoc(doc(db, 'users', user.uid), {
        upcomingLayovers: arrayUnion(layover),
      });
      
      Alert.alert(
        'Layover Added!',
        `Your ${city} layover has been added. You can now create plans for it.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Error adding layover:', error);
      Alert.alert('Error', 'Failed to add layover. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric'
    });
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <ThemedView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={28} color={Colors.primary} />
          </TouchableOpacity>
          <ThemedText style={styles.title}>Add Layover</ThemedText>
          <View style={{ width: 28 }} />
        </View>
        
        <ScrollView style={styles.content}>
          <ThemedText style={styles.subtitle}>
            Plan your layover up to 30 days in advance
          </ThemedText>
          
          {/* City Selection */}
          <View style={styles.inputContainer}>
            <ThemedText style={styles.label}>City *</ThemedText>
            <Pressable 
              style={styles.pickerButton}
              onPress={() => setShowCityPicker(true)}
            >
              <ThemedText style={city ? styles.pickerText : styles.placeholderText}>
                {city || 'Select City'}
              </ThemedText>
              <Ionicons name="chevron-down" size={20} color={Colors.text.secondary} />
            </Pressable>
          </View>
          
          {/* Area Selection */}
          {city && (
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Area *</ThemedText>
              <Pressable 
                style={styles.pickerButton}
                onPress={() => setShowAreaPicker(true)}
              >
                <ThemedText style={area ? styles.pickerText : styles.placeholderText}>
                  {area || 'Select Area'}
                </ThemedText>
                <Ionicons name="chevron-down" size={20} color={Colors.text.secondary} />
              </Pressable>
            </View>
          )}
          
          {/* Start Date */}
          <View style={styles.inputContainer}>
            <ThemedText style={styles.label}>Arrival Date *</ThemedText>
            <Pressable 
              style={styles.dateButton}
              onPress={() => setShowStartDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
              <ThemedText style={styles.dateText}>
                {formatDate(startDate)}
              </ThemedText>
            </Pressable>
          </View>
          
          {/* End Date */}
          <View style={styles.inputContainer}>
            <ThemedText style={styles.label}>Departure Date *</ThemedText>
            <Pressable 
              style={styles.dateButton}
              onPress={() => setShowEndDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
              <ThemedText style={styles.dateText}>
                {formatDate(endDate)}
              </ThemedText>
            </Pressable>
          </View>
          
          {/* Pre-discoverable Toggle */}
          <View style={styles.inputContainer}>
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.label}>Let crew find me early</ThemedText>
                <ThemedText style={styles.hint}>
                  Crew can see you'll be in {city || 'this city'} and invite you to plans
                </ThemedText>
              </View>
              <Switch
                value={preDiscoverable}
                onValueChange={setPreDiscoverable}
                trackColor={{ false: '#767577', true: Colors.primary }}
                thumbColor={preDiscoverable ? '#fff' : '#f4f3f4'}
              />
            </View>
          </View>
          
          {/* Save Button */}
          <TouchableOpacity 
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={24} color="#fff" />
                <ThemedText style={styles.saveButtonText}>Add Layover</ThemedText>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
        
        {/* City Picker Modal */}
        {showCityPicker && (
          <View style={styles.modal}>
            <SafeAreaView style={styles.modalFullScreen}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>Select City</ThemedText>
                <TouchableOpacity 
                  onPress={() => {
                    setShowCityPicker(false);
                    setCitySearchQuery('');
                  }}
                >
                  <Ionicons name="close" size={24} color={Colors.text.secondary} />
                </TouchableOpacity>
              </View>
              
              {/* Search Bar */}
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color={Colors.text.secondary} style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search cities or airport codes..."
                  placeholderTextColor={Colors.text.secondary}
                  value={citySearchQuery}
                  onChangeText={setCitySearchQuery}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  autoFocus
                />
                {citySearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setCitySearchQuery('')}>
                    <Ionicons name="close-circle" size={20} color={Colors.text.secondary} />
                  </TouchableOpacity>
                )}
              </View>
              
              {/* City List */}
              {filteredCities.length > 0 ? (
                <FlatList
                  data={filteredCities}
                  keyExtractor={(item) => item.name}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.cityItem}
                      onPress={() => {
                        setCity(item.name);
                        setArea(''); // Reset area when city changes
                        setShowCityPicker(false);
                        setCitySearchQuery('');
                      }}
                    >
                      <View style={styles.cityItemContent}>
                        <ThemedText style={styles.cityName}>{item.name}</ThemedText>
                        {item.code && (
                          <ThemedText style={styles.cityCode}>({item.code})</ThemedText>
                        )}
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={Colors.text.secondary} />
                    </TouchableOpacity>
                  )}
                  contentContainerStyle={styles.cityList}
                />
              ) : (
                <View style={styles.emptyState}>
                  <ThemedText style={styles.emptyStateText}>
                    No cities found matching "{citySearchQuery}"
                  </ThemedText>
                </View>
              )}
            </SafeAreaView>
          </View>
        )}
        
        {/* Area Picker Modal */}
        {showAreaPicker && selectedCityData && (
          <View style={styles.modal}>
            <SafeAreaView style={styles.modalFullScreen}>
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>Select Area in {city}</ThemedText>
                <TouchableOpacity onPress={() => setShowAreaPicker(false)}>
                  <Ionicons name="close" size={24} color={Colors.text.secondary} />
                </TouchableOpacity>
              </View>
              <FlatList
                data={selectedCityData.areas || []}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.cityItem}
                    onPress={() => {
                      setArea(item);
                      setShowAreaPicker(false);
                    }}
                  >
                    <ThemedText style={styles.cityName}>{item}</ThemedText>
                    <Ionicons name="chevron-forward" size={20} color={Colors.text.secondary} />
                  </TouchableOpacity>
                )}
                contentContainerStyle={styles.cityList}
              />
            </SafeAreaView>
          </View>
        )}
        
        {/* Date Picker Modals */}
        {/* Start Date Calendar */}
        <Modal
          visible={showStartDatePicker}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowStartDatePicker(false)}
        >
          <View style={styles.calendarModal}>
            <View style={styles.calendarContent}>
              <View style={styles.calendarHeader}>
                <ThemedText style={styles.calendarTitle}>Arrival Date</ThemedText>
                <TouchableOpacity onPress={() => setShowStartDatePicker(false)}>
                  <Ionicons name="close" size={24} color={Colors.text.secondary} />
                </TouchableOpacity>
              </View>
              
              <SimpleCalendar
                selectedDate={startDate}
                onSelectDate={(date) => {
                  setStartDate(date);
                  
                  // Auto-set end date to next day if it's before or same as start
                  if (endDate <= date) {
                    const nextDay = new Date(date);
                    nextDay.setDate(nextDay.getDate() + 1);
                    setEndDate(nextDay);
                  }
                  
                  setShowStartDatePicker(false);
                }}
                minDate={new Date()}
                maxDate={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)}
              />
              
              <TouchableOpacity
                style={styles.calendarCancelButton}
                onPress={() => setShowStartDatePicker(false)}
              >
                <ThemedText style={styles.calendarCancelText}>Cancel</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
        
        {/* End Date Calendar */}
        <Modal
          visible={showEndDatePicker}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowEndDatePicker(false)}
        >
          <View style={styles.calendarModal}>
            <View style={styles.calendarContent}>
              <View style={styles.calendarHeader}>
                <ThemedText style={styles.calendarTitle}>Departure Date</ThemedText>
                <TouchableOpacity onPress={() => setShowEndDatePicker(false)}>
                  <Ionicons name="close" size={24} color={Colors.text.secondary} />
                </TouchableOpacity>
              </View>
              
              <SimpleCalendar
                selectedDate={endDate}
                onSelectDate={(date) => {
                  setEndDate(date);
                  setShowEndDatePicker(false);
                }}
                minDate={startDate}
                maxDate={new Date(Date.now() + 31 * 24 * 60 * 60 * 1000)}
              />
              
              <TouchableOpacity
                style={styles.calendarCancelButton}
                onPress={() => setShowEndDatePicker(false)}
              >
                <ThemedText style={styles.calendarCancelText}>Cancel</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.text.secondary,
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  hint: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.card,
  },
  pickerText: {
    fontSize: 16,
    color: Colors.text.primary,
  },
  placeholderText: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: Colors.card,
    gap: 8,
  },
  dateText: {
    fontSize: 15,
    fontWeight: '500',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 20,
    marginBottom: 40,
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  modal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.background,
  },
  modalFullScreen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 20,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text.primary,
  },
  cityList: {
    paddingBottom: 20,
  },
  cityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  cityItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cityName: {
    fontSize: 17,
    fontWeight: '500',
  },
  cityCode: {
    fontSize: 15,
    color: Colors.text.secondary,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 15,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  calendarModal: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 20,
  },
  calendarContent: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    overflow: 'hidden',
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  calendarTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  calendarCancelButton: {
    paddingVertical: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  calendarCancelText: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
});
