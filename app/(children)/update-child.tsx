import { useAuth } from '@/contexts/AuthContext';
import { API_BASE_URL, getHealthConditions, getInterventions, HealthCondition, Intervention } from '@/lib/api';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function UpdateChildScreen() {
  const params = useLocalSearchParams<{
    childId?: string;
    childName?: string;
    weight?: string;
    height?: string;
    healthCondition?: string;
    interventions?: string;
  }>();
  const childId = params.childId as string;
  const childName = (params.childName as string) || 'Alvarez, Johnny D.';
  const { token, isAuthenticated, handleTokenInvalidation } = useAuth();
  const insets = useSafeAreaInsets();

  const [date, setDate] = useState<Date>(new Date());
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [weight, setWeight] = useState((params.weight as string) || '');
  const [height, setHeight] = useState((params.height as string) || '');
  const [healthConditions, setHealthConditions] = useState<HealthCondition[]>([]);
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [selectedHealthConditionIds, setSelectedHealthConditionIds] = useState<number[]>([]);
  const [selectedInterventionIds, setSelectedInterventionIds] = useState<number[]>([]);
  const [isHealthModalVisible, setIsHealthModalVisible] = useState(false);
  const [isInterventionModalVisible, setIsInterventionModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmationModalVisible, setConfirmationModalVisible] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [statusModalTitle, setStatusModalTitle] = useState<'Success' | 'Error'>('Success');
  const [statusModalMessage, setStatusModalMessage] = useState('');

  type FieldErrorKey = 'date' | 'weight' | 'height';
  const [errors, setErrors] = useState<Partial<Record<FieldErrorKey, string>>>({});

  useEffect(() => {
    const loadMeta = async () => {
      if (!token || !isAuthenticated) {
        setIsLoading(false);
        return;
      }
      try {
        const [hc, iv] = await Promise.all([
          getHealthConditions(token),
          getInterventions(token),
        ]);
        setHealthConditions(hc);
        setInterventions(iv);

        // Preselect based on names passed from child-details (comma-separated)
        const conditionNames =
          (params.healthCondition as string | undefined)
            ?.split(',')
            .map(name => name.trim().toLowerCase())
            .filter(Boolean) || [];

        if (conditionNames.length > 0) {
          const hcIds = hc
            .filter(item => conditionNames.includes(item.condition_name.toLowerCase()))
            .map(item => item.health_condition_id);
          setSelectedHealthConditionIds(hcIds);
        }

        const interventionNames =
          (params.interventions as string | undefined)
            ?.split(',')
            .map(name => name.trim().toLowerCase())
            .filter(Boolean) || [];

        if (interventionNames.length > 0) {
          const ivIds = iv
            .filter(item => interventionNames.includes(item.intervention_name.toLowerCase()))
            .map(item => item.intervention_id);
          setSelectedInterventionIds(ivIds);
        }
      } catch (error) {
        console.error('Error loading meta for update-child:', error);
        if (error instanceof Error && error.message === 'TOKEN_INVALIDATED') {
          handleTokenInvalidation();
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadMeta();
  }, [token, isAuthenticated, handleTokenInvalidation, params.healthCondition, params.interventions]);

  const handleCancel = () => {
    router.back();
  };

  const handleSaveClick = () => {
    if (isSaving) return;

    const newErrors: Partial<Record<FieldErrorKey, string>> = {};

    if (!date) {
      newErrors.date = 'Date is required.';
    }
    if (!weight || Number.isNaN(Number(weight))) {
      newErrors.weight = 'Weight is required and must be a number.';
    }
    if (!height || Number.isNaN(Number(height))) {
      newErrors.height = 'Height is required and must be a number.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setConfirmationModalVisible(true);
  };

  const handleConfirmSave = async () => {
    if (isSaving) return;
    setConfirmationModalVisible(false);

    const payload = {
      date: date.toISOString().split('T')[0],
      weight: parseFloat(weight),
      height: parseFloat(height),
      health_condition_ids: selectedHealthConditionIds,
      intervention_ids: selectedInterventionIds,
    };

    setIsSaving(true);

    if (!token || !isAuthenticated) {
      console.log('Submitting update (no token, test only):', {
        childId,
        ...payload,
      });
      setStatusModalTitle('Success');
      setStatusModalMessage('Update payload logged to console (test only).');
      setStatusModalVisible(true);
      setIsSaving(false);
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/children/${childId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        },
      );

      const data = await response.json() as { errors?: Record<string, string[]>; message?: string };
      console.log('Update child progress API response:', data);

      if (!response.ok) {
        let message = 'Failed to update child progress.';
        if (data && data.errors) {
          const firstKey = Object.keys(data.errors)[0];
          const firstMsgArr = data.errors[firstKey];
          message =
            Array.isArray(firstMsgArr) && firstMsgArr.length > 0
              ? firstMsgArr[0]
              : data.message || 'Validation failed.';
        } else if (data && data.message) {
          message = data.message;
        }
        setStatusModalTitle('Error');
        setStatusModalMessage(message);
        setStatusModalVisible(true);
        return;
      }

      setStatusModalTitle('Success');
      setStatusModalMessage('Child progress has been updated successfully.');
      setStatusModalVisible(true);
    } catch (error) {
      console.error('Error updating child progress:', error);
      setStatusModalTitle('Error');
      setStatusModalMessage('Something went wrong while updating progress.');
      setStatusModalVisible(true);
    } finally {
      setIsSaving(false);
    }
  };

  const incrementWeight = () => {
    const current = parseFloat(weight) || 0;
    setWeight((current + 0.1).toFixed(1));
  };

  const decrementWeight = () => {
    const current = parseFloat(weight) || 0;
    if (current > 0) {
      setWeight((current - 0.1).toFixed(1));
    }
  };

  const incrementHeight = () => {
    const current = parseFloat(height) || 0;
    setHeight((current + 1).toString());
  };

  const decrementHeight = () => {
    const current = parseFloat(height) || 0;
    if (current > 0) {
      setHeight((current - 1).toString());
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}>
          <View style={styles.content}>
            <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
              <TouchableOpacity
                onPress={handleCancel}
                style={styles.headerBack}>
                <Ionicons name="chevron-back" size={22} color="#111827" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Update Child Progress</Text>
              <View style={styles.headerRightSpacer} />
            </View>
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#4F46E5" />
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}>
        <View style={styles.content}>
          {/* Header */}
          <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
            <TouchableOpacity
              onPress={handleCancel}
              style={styles.headerBack}>
              <Ionicons name="chevron-back" size={22} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Update Child Progress</Text>
            <View style={styles.headerRightSpacer} />
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}>
            {/* Gradient Banner */}
            <LinearGradient
              colors={['#60A5FA', '#A855F7']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.banner}>
              <View style={styles.bannerAvatar}>
                <LinearGradient
                  colors={['#60A5FA', '#A855F7']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.avatarCircle}>
                  <Ionicons name="person" size={24} color="#FFFFFF" />
                </LinearGradient>
              </View>
              <Text style={styles.bannerName}>{childName}</Text>
            </LinearGradient>

            {/* Form Fields */}
            <View style={styles.formContainer}>
              {/* Date Field */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Date</Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.iconInput}
                  onPress={() => setIsDatePickerVisible(true)}>
                  <Text style={styles.iconInputText}>
                    {date.toLocaleDateString()}
                  </Text>
                  <Ionicons name="calendar-outline" size={18} color="#9CA3AF" />
                </TouchableOpacity>
                {isDatePickerVisible && (
                  <DateTimePicker
                    value={date}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedDate) => {
                      if (event.type === 'dismissed') {
                        setIsDatePickerVisible(false);
                        return;
                      }
                      if (selectedDate) {
                        setDate(selectedDate);
                      }
                      if (Platform.OS !== 'ios') {
                        setIsDatePickerVisible(false);
                      }
                    }}
                  />
                )}
              </View>

              {/* Weight Field */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Weight (kg)</Text>
                <View
                  style={[
                    styles.numberInputContainer,
                    errors.weight && styles.fieldInputError,
                  ]}>
                  <TextInput
                    style={styles.numberInput}
                    placeholder="0.0"
                    placeholderTextColor="#9CA3AF"
                    value={weight}
                    onChangeText={text => {
                      setErrors(prev => ({ ...prev, weight: undefined }));
                      setWeight(text);
                    }}
                    keyboardType="decimal-pad"
                  />
                </View>
                {errors.weight && (
                  <Text style={styles.errorText}>{errors.weight}</Text>
                )}
              </View>

              {/* Height Field */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Height (cm)</Text>
                <View
                  style={[
                    styles.numberInputContainer,
                    errors.height && styles.fieldInputError,
                  ]}>
                  <TextInput
                    style={styles.numberInput}
                    placeholder="0"
                    placeholderTextColor="#9CA3AF"
                    value={height}
                    onChangeText={text => {
                      setErrors(prev => ({ ...prev, height: undefined }));
                      setHeight(text);
                    }}
                    keyboardType="number-pad"
                  />
                </View>
                {errors.height && (
                  <Text style={styles.errorText}>{errors.height}</Text>
                )}
              </View>

              {/* Health Conditions Field (multi-select) */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Health Conditions</Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.dropdownInput}
                  onPress={() => setIsHealthModalVisible(true)}>
                  <Text
                    style={
                      selectedHealthConditionIds.length
                        ? styles.dropdownValue
                        : styles.dropdownPlaceholder
                    }>
                    {selectedHealthConditionIds.length
                      ? healthConditions
                          .filter(hc =>
                            selectedHealthConditionIds.includes(
                              hc.health_condition_id,
                            ),
                          )
                          .map(hc => hc.condition_name)
                          .join(', ')
                      : 'Select health conditions'}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              </View>

              {/* Interventions Field (multi-select) */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Interventions</Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.dropdownInput}
                  onPress={() => setIsInterventionModalVisible(true)}>
                  <Text
                    style={
                      selectedInterventionIds.length
                        ? styles.dropdownValue
                        : styles.dropdownPlaceholder
                    }>
                    {selectedInterventionIds.length
                      ? interventions
                          .filter(iv =>
                            selectedInterventionIds.includes(
                              iv.intervention_id,
                            ),
                          )
                          .map(iv => iv.intervention_name)
                          .join(', ')
                      : 'Select interventions'}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>

          {/* Footer Buttons */}
          <View style={[styles.footerButtons, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, isSaving && { opacity: 0.7 }]}
              onPress={handleSaveClick}
              disabled={isSaving}>
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Health Conditions Modal */}
          <Modal
            visible={isHealthModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setIsHealthModalVisible(false)}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Select Health Conditions</Text>
                <ScrollView style={styles.modalList}>
                  {healthConditions.map(condition => {
                    const selected = selectedHealthConditionIds.includes(
                      condition.health_condition_id,
                    );
                    return (
                      <TouchableOpacity
                        key={condition.health_condition_id}
                        style={styles.modalOption}
                        onPress={() => {
                          setSelectedHealthConditionIds(prev => {
                            if (prev.includes(condition.health_condition_id)) {
                              return prev.filter(
                                id => id !== condition.health_condition_id,
                              );
                            }
                            return [...prev, condition.health_condition_id];
                          });
                        }}>
                        <View
                          style={[
                            styles.checkbox,
                            selected && styles.checkboxSelected,
                          ]}>
                          {selected && (
                            <Ionicons
                              name="checkmark"
                              size={14}
                              color="#FFFFFF"
                            />
                          )}
                        </View>
                        <Text style={styles.modalOptionText}>
                          {condition.condition_name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <View style={styles.modalFooter}>
                  <TouchableOpacity
                    style={styles.modalCancelButton}
                    onPress={() => setIsHealthModalVisible(false)}>
                    <Text style={styles.modalCancelText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* Interventions Modal */}
          <Modal
            visible={isInterventionModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setIsInterventionModalVisible(false)}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Select Interventions</Text>
                <ScrollView style={styles.modalList}>
                  {interventions.map(intervention => {
                    const selected = selectedInterventionIds.includes(
                      intervention.intervention_id,
                    );
                    return (
                      <TouchableOpacity
                        key={intervention.intervention_id}
                        style={styles.modalOption}
                        onPress={() => {
                          setSelectedInterventionIds(prev => {
                            if (prev.includes(intervention.intervention_id)) {
                              return prev.filter(
                                id => id !== intervention.intervention_id,
                              );
                            }
                            return [...prev, intervention.intervention_id];
                          });
                        }}>
                        <View
                          style={[
                            styles.checkbox,
                            selected && styles.checkboxSelected,
                          ]}>
                          {selected && (
                            <Ionicons
                              name="checkmark"
                              size={14}
                              color="#FFFFFF"
                            />
                          )}
                        </View>
                        <Text style={styles.modalOptionText}>
                          {intervention.intervention_name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <View style={styles.modalFooter}>
                  <TouchableOpacity
                    style={styles.modalCancelButton}
                    onPress={() => setIsInterventionModalVisible(false)}>
                    <Text style={styles.modalCancelText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* Confirmation Modal */}
          <Modal
            visible={confirmationModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setConfirmationModalVisible(false)}>
            <View style={styles.modalOverlay}>
              <View style={styles.confirmationModalContent}>
                <Text style={styles.confirmationModalTitle}>Confirm Save</Text>
                <Text style={styles.confirmationModalMessage}>
                  Are you sure you want to save these changes?
                </Text>
                <View style={styles.confirmationModalButtons}>
                  <TouchableOpacity
                    style={styles.confirmationModalCancelButton}
                    onPress={() => setConfirmationModalVisible(false)}>
                    <Text style={styles.confirmationModalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.confirmationModalConfirmButton}
                    onPress={handleConfirmSave}>
                    <Text style={styles.confirmationModalConfirmText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* Status Modal */}
          <Modal
            visible={statusModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setStatusModalVisible(false)}>
            <View style={styles.modalOverlay}>
              <View style={styles.statusModalContent}>
                <Text
                  style={[
                    styles.statusModalTitle,
                    statusModalTitle === 'Success'
                      ? { color: '#16A34A' }
                      : { color: '#DC2626' },
                  ]}>
                  {statusModalTitle}
                </Text>
                <Text style={styles.statusModalMessage}>
                  {statusModalMessage}
                </Text>
                <TouchableOpacity
                  style={styles.statusModalButton}
                  onPress={() => {
                    setStatusModalVisible(false);
                    if (statusModalTitle === 'Success') {
                      router.replace({
                        pathname: '/(children)/child-details',
                        params: { id: childId },
                      } as any);
                    }
                  }}>
                  <Text style={styles.statusModalButtonText}>OK</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  keyboardView: {
    flex: 1,
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
    color: '#111827',
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
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    gap: 12,
  },
  bannerAvatar: {
    marginRight: 8,
  },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  formContainer: {
    paddingHorizontal: 16,
    marginTop: 24,
    gap: 20,
  },
  fieldGroup: {
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  iconInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#D1D5DB',
    paddingVertical: 12,
    paddingRight: 8,
  },
  iconInputText: {
    fontSize: 16,
    color: '#111827',
    flex: 1,
  },
  numberInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#D1D5DB',
    paddingVertical: 12,
  },
  numberInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    paddingRight: 8,
  },
  dropdownInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#D1D5DB',
    paddingVertical: 12,
    paddingRight: 8,
  },
  dropdownValue: {
    fontSize: 16,
    color: '#111827',
    flex: 1,
  },
  dropdownPlaceholder: {
    fontSize: 16,
    color: '#9CA3AF',
    flex: 1,
  },
  footerButtons: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    gap: 8,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#9333EA',
    gap: 8,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  fieldInputError: {
    borderBottomColor: '#DC2626',
  },
  errorText: {
    marginTop: 4,
    fontSize: 12,
    color: '#DC2626',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxHeight: '70%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#111827',
  },
  modalList: {
    maxHeight: 260,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  modalOptionText: {
    fontSize: 14,
    color: '#111827',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxSelected: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  modalFooter: {
    marginTop: 12,
    alignItems: 'flex-end',
  },
  modalCancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  modalCancelText: {
    fontSize: 14,
    color: '#4B5563',
    fontWeight: '500',
  },
  statusModalContent: {
    width: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
  },
  statusModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  statusModalMessage: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 16,
  },
  statusModalButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#2563EB',
  },
  statusModalButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  confirmationModalContent: {
    width: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
  },
  confirmationModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  confirmationModalMessage: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 20,
  },
  confirmationModalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmationModalCancelButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  confirmationModalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  confirmationModalConfirmButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: '#9333EA',
    alignItems: 'center',
  },
  confirmationModalConfirmText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

