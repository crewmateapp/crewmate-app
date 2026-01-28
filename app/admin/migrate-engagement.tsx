// app/admin/migrate-engagement.tsx
/**
 * Admin Page: Run Engagement System Migration
 * 
 * Access: Super admins only
 * Purpose: Add engagement fields to all existing users
 */

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/contexts/AuthContext';
import { isSuperAdmin, useAdminRole } from '@/hooks/useAdminRole';
import { migrateUsersToEngagement, dryRunMigration } from '@/scripts/migrateUsersToEngagement';
import { useState } from 'react';
import { View, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function MigrateEngagementScreen() {
  const { user } = useAuth();
  const { role, loading: roleLoading } = useAdminRole();
  const [isRunning, setIsRunning] = useState(false);
  const [isDryRun, setIsDryRun] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<any>(null);

  // Check admin access
  if (!user || roleLoading) {
    return (
      <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#114878" />
      </ThemedView>
    );
  }

  if (!isSuperAdmin(role)) {
    return (
      <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Ionicons name="lock-closed" size={64} color="#FF3B30" />
        <ThemedText style={{ fontSize: 20, fontWeight: '600', marginTop: 20, textAlign: 'center' }}>
          Access Denied
        </ThemedText>
        <ThemedText style={{ marginTop: 10, textAlign: 'center', opacity: 0.7 }}>
          This page is only accessible to super admins.
        </ThemedText>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            marginTop: 30,
            paddingVertical: 12,
            paddingHorizontal: 24,
            backgroundColor: '#114878',
            borderRadius: 10,
          }}
        >
          <ThemedText style={{ color: '#fff', fontWeight: '600' }}>Go Back</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  const handleDryRun = async () => {
    setIsDryRun(true);
    setIsRunning(true);
    setLogs([]);
    setResult(null);

    // Capture console.log output
    const originalLog = console.log;
    const logCapture: string[] = [];
    console.log = (...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      logCapture.push(message);
      setLogs(prev => [...prev, message]);
      originalLog(...args);
    };

    try {
      await dryRunMigration();
      Alert.alert('Dry Run Complete', 'Check the logs below to see what would be updated.');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      console.log = originalLog;
      setIsRunning(false);
      setIsDryRun(false);
    }
  };

  const handleMigration = async () => {
    Alert.alert(
      'Confirm Migration',
      'This will add engagement fields to ALL users in the database. This action cannot be undone. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Run Migration',
          style: 'destructive',
          onPress: async () => {
            setIsRunning(true);
            setLogs([]);
            setResult(null);

            // Capture console.log output
            const originalLog = console.log;
            const logCapture: string[] = [];
            console.log = (...args: any[]) => {
              const message = args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
              ).join(' ');
              logCapture.push(message);
              setLogs(prev => [...prev, message]);
              originalLog(...args);
            };

            try {
              const migrationResult = await migrateUsersToEngagement();
              setResult(migrationResult);
              Alert.alert('Migration Complete!', `Updated ${migrationResult.updated} users.`);
            } catch (error: any) {
              Alert.alert('Error', error.message);
            } finally {
              console.log = originalLog;
              setIsRunning(false);
            }
          }
        }
      ]
    );
  };

  return (
    <ScrollView style={{ flex: 1 }}>
      <ThemedView style={{ flex: 1, padding: 20 }}>
        {/* Header */}
        <View style={{ marginBottom: 30 }}>
          <ThemedText style={{ fontSize: 28, fontWeight: 'bold', marginBottom: 8 }}>
            🚀 Engagement System Migration
          </ThemedText>
          <ThemedText style={{ fontSize: 16, opacity: 0.7 }}>
            Add engagement fields (CMS, badges, stats) to existing users
          </ThemedText>
        </View>

        {/* Instructions */}
        <View style={{ 
          backgroundColor: '#114878', 
          padding: 16, 
          borderRadius: 12, 
          marginBottom: 20 
        }}>
          <ThemedText style={{ fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 8 }}>
            📋 Instructions
          </ThemedText>
          <ThemedText style={{ fontSize: 14, color: '#fff', opacity: 0.9, lineHeight: 20 }}>
            1. Run a DRY RUN first to see what would be updated{'\n'}
            2. Review the output carefully{'\n'}
            3. If everything looks good, run the actual migration{'\n'}
            4. Users will get CMS for past check-ins, plans, reviews, etc.
          </ThemedText>
        </View>

        {/* Action Buttons */}
        <View style={{ gap: 12, marginBottom: 30 }}>
          <TouchableOpacity
            onPress={handleDryRun}
            disabled={isRunning}
            style={{
              backgroundColor: isRunning ? '#ccc' : '#FF9500',
              padding: 16,
              borderRadius: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isDryRun ? (
              <ActivityIndicator color="#fff" style={{ marginRight: 8 }} />
            ) : (
              <Ionicons name="eye" size={20} color="#fff" style={{ marginRight: 8 }} />
            )}
            <ThemedText style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
              Run Dry Run (No Changes)
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleMigration}
            disabled={isRunning}
            style={{
              backgroundColor: isRunning ? '#ccc' : '#34C759',
              padding: 16,
              borderRadius: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isRunning && !isDryRun ? (
              <ActivityIndicator color="#fff" style={{ marginRight: 8 }} />
            ) : (
              <Ionicons name="rocket" size={20} color="#fff" style={{ marginRight: 8 }} />
            )}
            <ThemedText style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
              Run Full Migration
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Results */}
        {result && (
          <View style={{
            backgroundColor: '#34C759',
            padding: 16,
            borderRadius: 12,
            marginBottom: 20,
          }}>
            <ThemedText style={{ fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 12 }}>
              ✅ Migration Complete!
            </ThemedText>
            <ThemedText style={{ color: '#fff', fontSize: 14, lineHeight: 20 }}>
              Total Users: {result.total}{'\n'}
              Updated: {result.updated}{'\n'}
              Skipped: {result.skipped}{'\n'}
              Errors: {result.errors}
            </ThemedText>
          </View>
        )}

        {/* Logs */}
        {logs.length > 0 && (
          <View style={{ marginBottom: 30 }}>
            <ThemedText style={{ fontSize: 18, fontWeight: '600', marginBottom: 12 }}>
              📝 Logs
            </ThemedText>
            <View style={{
              backgroundColor: '#000',
              padding: 16,
              borderRadius: 12,
              maxHeight: 400,
            }}>
              <ScrollView>
                {logs.map((log, index) => (
                  <ThemedText
                    key={index}
                    style={{
                      fontFamily: 'monospace',
                      fontSize: 12,
                      color: '#0F0',
                      marginBottom: 4,
                    }}
                  >
                    {log}
                  </ThemedText>
                ))}
              </ScrollView>
            </View>
          </View>
        )}
      </ThemedView>
    </ScrollView>
  );
}
