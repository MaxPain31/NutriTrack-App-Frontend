import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function ProfileSettingScreen() {
  const { user } = useAuth();

  // Format full name from profile data
  const getFullName = () => {
    if (!user?.profile) return user?.username || '';
    const { user_first_name, user_middle_name, user_last_name } = user.profile;
    const middleInitial = user_middle_name ? `${user_middle_name.charAt(0).toUpperCase()}. ` : '';
    return `${user_first_name} ${middleInitial}${user_last_name}`;
  };

  // Format role name (capitalize first letter of each word)
  const getRoleName = () => {
    if (!user?.role?.role_name) return '';
    return user.role.role_name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Format birthdate from "2024-12-18" to "12/18/2024"
  const formatBirthdate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };

  // Get address from barangay and municipality data
  const getAddress = () => {
    if (!user?.profile?.barangay || !user?.profile?.municipality) {
      return '';
    }
    const barangayName = user.profile.barangay.barangay_name;
    const municipalityName = user.profile.municipality.municipality_name;
    return `${barangayName}, ${municipalityName}`;
  };

  const userProfile = {
    fullName: getFullName(),
    role: getRoleName(),
    username: user?.username || '',
    email: user?.email || '',
    address: getAddress(),
    birthdate: user?.profile?.user_birthdate ? formatBirthdate(user.profile.user_birthdate) : '',
  };

  const renderDetailItem = (
    icon: string,
    label: string,
    value: string,
  ) => (
    <View style={styles.detailItem}>
      <Ionicons name={icon as any} size={20} color="#9CA3AF" style={styles.detailIcon} />
      <View style={styles.detailContent}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.headerBack}>
            <Ionicons name="chevron-back" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>User Profile</Text>
          <View style={styles.headerRightSpacer} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Gradient Header Section */}
          <LinearGradient
            colors={['#60A5FA', '#A855F7']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatarCircle}>
                <LinearGradient
                  colors={['#60A5FA', '#A855F7']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.avatarInner}>
                  <Ionicons name="person" size={40} color="#FFFFFF" />
                </LinearGradient>
              </View>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{userProfile.fullName}</Text>
              <Text style={styles.profileRole}>{userProfile.role}</Text>
            </View>
          </LinearGradient>

          {/* User Details Section */}
          <View style={styles.detailsSection}>
            {renderDetailItem('person-outline', 'USERNAME', userProfile.username)}
            {renderDetailItem('mail-outline', 'EMAIL ADDRESS', userProfile.email)}
            {renderDetailItem('location-outline', 'ADDRESS', userProfile.address)}
            {renderDetailItem('calendar-outline', 'BIRTHDATE', userProfile.birthdate)}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerBack: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerRightSpacer: {
    width: 30,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    marginBottom: 16,
    gap: 16,
  },
  avatarContainer: {
    marginRight: 8,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  detailsSection: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 20,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  detailIcon: {
    marginTop: 2,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
});
