import { useAuth } from '@/contexts/AuthContext';
import { ChildData, getChildById } from '@/lib/api';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ChildDetailsScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    name?: string;
    height?: string;
    weight?: string;
    ageMonths?: string;
    birthdate?: string;
    sex?: string;
    address?: string;
    weightForHeight?: string;
    weightForAge?: string;
    heightForAge?: string;
    activeIntervention?: string;
    healthCondition?: string;
  }>();

  const childId = (params.id as string) || '1';
  const { token, isAuthenticated, handleTokenInvalidation } = useAuth();
  const insets = useSafeAreaInsets();

  interface ChildDetailsData {
    id: string;
    name: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    nameExtension: string | null;
    height: number;
    weight: number;
    ageMonths: number;
    birthdate: string;
    sex: string;
    address: string;
    municipalityName?: string;
    barangayName?: string;
    caregiver: string | null;
    caregiverFirstName?: string | null;
    caregiverMiddleName?: string | null;
    caregiverLastName?: string | null;
    activeIntervention: string | null;
    healthCondition: string | null;
    weightForHeight: string;
    weightForAge: string;
    heightForAge: string;
  }

  const [childData, setChildData] = useState<ChildDetailsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const toTitleCase = (value: string) =>
    value
      .toLowerCase()
      .split(' ')
      .filter(Boolean)
      .map(word => word[0].toUpperCase() + word.slice(1))
      .join(' ');

  useEffect(() => {
    const loadChild = async () => {
      if (!token || !isAuthenticated || !childId) {
        setIsLoading(false);
        return;
      }

      try {
        const apiChild: ChildData = await getChildById(token, childId);

        const middleInitial = apiChild.child_middle_name
          ? `${apiChild.child_middle_name.charAt(0).toUpperCase()}. `
          : '';
        const fullName = `${apiChild.child_first_name} ${middleInitial}${apiChild.child_last_name}`;
        const displayName = toTitleCase(fullName);

        const barangayName = apiChild.barangay?.barangay_name;
        const municipalityName = apiChild.municipality?.municipality_name;
        const address =
          barangayName && municipalityName
            ? `${barangayName}, ${municipalityName}`
            : '';

        const interventionsList =
          apiChild.interventions && apiChild.interventions.length > 0
            ? apiChild.interventions
                .map(i => i.intervention?.intervention_name)
                .filter(Boolean)
                .join(', ')
            : null;

        const healthConditionsList =
          apiChild.health_conditions && apiChild.health_conditions.length > 0
            ? apiChild.health_conditions
                .map(h => h.health_condition?.condition_name)
                .filter(Boolean)
                .join(', ')
            : null;

        // Construct caregiver full name
        const caregiverFirstName = apiChild.caregiver?.caregiver_first_name ?? null;
        const caregiverMiddleName = apiChild.caregiver?.caregiver_middle_name ?? null;
        const caregiverLastName = apiChild.caregiver?.caregiver_last_name ?? null;
        let caregiverFullName: string | null = null;
        if (caregiverFirstName || caregiverLastName) {
          const middleInitial = caregiverMiddleName
            ? `${caregiverMiddleName.charAt(0).toUpperCase()}. `
            : '';
          caregiverFullName = `${caregiverFirstName || ''} ${middleInitial}${caregiverLastName || ''}`.trim();
          caregiverFullName = toTitleCase(caregiverFullName);
        }

        setChildData({
          id: apiChild.child_id,
          name: displayName,
          firstName: apiChild.child_first_name,
          middleName: apiChild.child_middle_name ?? null,
          lastName: apiChild.child_last_name,
          nameExtension: apiChild.name_extension_id ? String(apiChild.name_extension_id) : null,
          height: parseFloat(apiChild.height) || 0,
          weight: parseFloat(apiChild.weight) || 0,
          ageMonths: apiChild.age,
          birthdate: apiChild.child_birthdate,
          sex: apiChild.sex?.sex || '',
          address,
          municipalityName,
          barangayName,
          caregiver: caregiverFullName,
          caregiverFirstName,
          caregiverMiddleName,
          caregiverLastName,
          activeIntervention: interventionsList,
          healthCondition: healthConditionsList,
          weightForHeight: apiChild.wfh?.wfh_status || 'Unknown',
          weightForAge: apiChild.wfa?.wfa_status || 'Unknown',
          heightForAge: apiChild.hfa?.hfa_status || 'Unknown',
        });
      } catch (error) {
        console.error('Error loading child details:', error);
        if (error instanceof Error && error.message === 'TOKEN_INVALIDATED') {
          handleTokenInvalidation();
          return;
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadChild();
  }, [token, isAuthenticated, childId, handleTokenInvalidation]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: string | undefined) => {
    const normalized = (status || '').toLowerCase();
    switch (normalized) {
      case 'normal':
        return { bg: '#D1FAE5', text: '#065F46' };
      case 'severely stunted':
      case 'severely wasted':
      case 'severely underweight':
        return { bg: '#FEE2E2', text: '#B91C1C' };
      case 'stunted':
      case 'moderately wasted':
      case 'underweight':
      case 'overweight':
      case 'obese':
        return { bg: '#FEF3C7', text: '#92400E' };
      case 'tall':
        return { bg: '#DBEAFE', text: '#1D4ED8' };
      case 'error':
      default:
        return { bg: '#F3F4F6', text: '#6B7280' };
    }
  };

  if (isLoading || !childData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.headerBack}>
              <Ionicons name="chevron-back" size={22} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Child Details</Text>
            <View style={styles.headerRightSpacer} />
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4F46E5" />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.headerBack}>
            <Ionicons name="chevron-back" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Child Details</Text>
          <View style={styles.headerRightSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}>
          {/* Main Child Info Card with Gradient */}
          <View style={styles.mainCard}>
            <LinearGradient
              colors={['#60A5FA', '#A855F7']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.gradientCard}>
              <View style={styles.avatarContainer}>
                <View style={styles.avatarCircle}>
                  <Ionicons name="person" size={40} color="#FFFFFF" />
                </View>
              </View>
              <Text style={styles.childName}>{childData.name}</Text>
              <View style={styles.metricsRow}>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Height</Text>
                  <Text style={styles.metricValue}>{childData.height} cm</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Weight</Text>
                  <Text style={styles.metricValue}>
                    {childData.weight} kg
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          {/* Caregiver and Demographics Card */}
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Caregiver</Text>
              <Text style={styles.infoValue}>
                {childData.caregiver || 'No Caregiver Set'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Age & Birthdate</Text>
              <View>
                <Text style={styles.infoValue}>
                  {childData.ageMonths} Months
                </Text>
                <Text style={styles.infoSubValue}>
                  {formatDate(childData.birthdate)}
                </Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Sex</Text>
              <Text style={styles.infoValue}>{childData.sex}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Address</Text>
              <Text style={styles.infoValue}>{childData.address}</Text>
            </View>
          </View>

          {/* Active Intervention & Health Condition Card */}
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.interventionLabel}>ACTIVE INTERVENTION</Text>
              <Text style={styles.infoValue}>
                {childData.activeIntervention || 'No Intervention Recorded'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.healthConditionLabel}>HEALTH CONDITION</Text>
              <Text style={styles.infoValue}>
                {childData.healthCondition || 'No Health Condition Recorded'}
              </Text>
            </View>
          </View>

          {/* Nutritional Status Card */}
          <View style={styles.nutritionCard}>
            <Text style={styles.nutritionTitle}>Nutritional Status</Text>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Weight for Height</Text>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: getStatusColor(childData.weightForHeight).bg,
                  },
                ]}>
                <Text
                  style={[
                    styles.statusBadgeText,
                    { color: getStatusColor(childData.weightForHeight).text },
                  ]}>
                  {childData.weightForHeight}
                </Text>
              </View>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Weight for Age</Text>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: getStatusColor(childData.weightForAge).bg,
                  },
                ]}>
                <Text
                  style={[
                    styles.statusBadgeText,
                    { color: getStatusColor(childData.weightForAge).text },
                  ]}>
                  {childData.weightForAge}
                </Text>
              </View>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Height for Age</Text>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: getStatusColor(childData.heightForAge).bg,
                  },
                ]}>
                <Text
                  style={[
                    styles.statusBadgeText,
                    { color: getStatusColor(childData.heightForAge).text },
                  ]}>
                  {childData.heightForAge}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={[styles.footerButtons, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() =>
              router.push({
                pathname: '/(children)/edit-child',
                params: {
                  childId: childData.id,
                  firstName: childData.firstName,
                  middleName: childData.middleName || '',
                  lastName: childData.lastName,
                  nameExtension: childData.nameExtension || '',
                  birthdate: childData.birthdate,
                  weight: String(childData.weight),
                  height: String(childData.height),
                  sex: childData.sex,
                  healthCondition: childData.healthCondition || '',
                  barangayName: childData.barangayName || '',
                  municipalityName: childData.municipalityName || '',
                  caregiverFirstName: childData.caregiverFirstName || '',
                  caregiverMiddleName: childData.caregiverMiddleName || '',
                  caregiverLastName: childData.caregiverLastName || '',
                },
              } as any)
            }>
            <Ionicons name="create-outline" size={18} color="#FFFFFF" />
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.updateButton}
            onPress={() =>
              router.push({
                pathname: '/(children)/update-child',
                params: {
                  childId: childData.id,
                  childName: childData.name,
                  weight: String(childData.weight),
                  height: String(childData.height),
                  healthCondition: childData.healthCondition || '',
                  interventions: childData.activeIntervention || '',
                },
              } as any)
            }>
            <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
            <Text style={styles.updateButtonText}>Update</Text>
          </TouchableOpacity>
        </View>
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
    paddingBottom: 12,
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
    padding: 16,
    gap: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  mainCard: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 4,
  },
  gradientCard: {
    padding: 24,
    alignItems: 'center',
    borderRadius: 12,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  childName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 20,
    textAlign: 'center',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 32,
    width: '100%',
    justifyContent: 'center',
  },
  metric: {
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  infoRow: {
    marginBottom: 16,
  },
  infoRowLast: {
    marginBottom: 0,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
  },
  infoSubValue: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  interventionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
    marginBottom: 4,
  },
  healthConditionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9333EA',
    marginBottom: 4,
  },
  nutritionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },  
  nutritionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusRowLast: {
    marginBottom: 0,
  },
  statusLabel: {
    fontSize: 14,
    color: '#111827',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  footerButtons: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  updateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9333EA',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  updateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

