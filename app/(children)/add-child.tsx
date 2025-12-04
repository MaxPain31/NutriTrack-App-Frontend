import { useAuth } from '@/contexts/AuthContext';
import { HealthCondition, getHealthConditions } from '@/lib/api';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
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
  View
} from 'react-native';

export default function AddChildScreen() {
  const { user, token, isAuthenticated, handleTokenInvalidation } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nameExtension, setNameExtension] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [sex, setSex] = useState<'Male' | 'Female' | ''>('');
  const [healthConditions, setHealthConditions] = useState<HealthCondition[]>([]);
  const [selectedHealthConditionIds, setSelectedHealthConditionIds] = useState<number[]>([]);
  const [isHealthModalVisible, setIsHealthModalVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [statusModalTitle, setStatusModalTitle] = useState<'Success' | 'Error'>('Success');
  const [statusModalMessage, setStatusModalMessage] = useState('');

  type FieldErrorKey = 'firstName' | 'lastName' | 'birthdate' | 'weight' | 'height' | 'sex';
  const [errors, setErrors] = useState<Partial<Record<FieldErrorKey, string>>>({});

  useEffect(() => {
    const loadHealthConditions = async () => {
      if (!token || !isAuthenticated) return;

      try {
        const data = await getHealthConditions(token);
        setHealthConditions(data);
      } catch (error) {
        console.error('Error loading health conditions:', error);
        if (error instanceof Error && error.message === 'TOKEN_INVALIDATED') {
          handleTokenInvalidation();
          return;
        }
      }
    };

    loadHealthConditions();
  }, [token, isAuthenticated, handleTokenInvalidation]);

  const handleCancel = () => {
    router.back();
  };

  const handleSave = async () => {
    if (isSaving) return;

    const newErrors: Partial<Record<FieldErrorKey, string>> = {};

    if (!firstName.trim()) {
      newErrors.firstName = 'First Name is required.';
    }
    if (!lastName.trim()) {
      newErrors.lastName = 'Last Name is required.';
    }
    if (!birthdate.trim()) {
      newErrors.birthdate = 'Birthdate is required.';
    }
    if (!weight || Number.isNaN(Number(weight))) {
      newErrors.weight = 'Weight is required and must be a number.';
    }
    if (!height || Number.isNaN(Number(height))) {
      newErrors.height = 'Height is required and must be a number.';
    }
    if (!sex) {
      newErrors.sex = 'Sex is required.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});

    // Map to API field names / formats
    const sex_id = sex === 'Male' ? 1 : sex === 'Female' ? 2 : null;

    const payload = {
      child_first_name: firstName,
      child_middle_name: middleName || null,
      child_last_name: lastName,
      name_extension_id: nameExtension || null,
      child_birthdate: birthdate, // already YYYY-MM-DD
      weight,
      height,
      sex_id,
      health_condition_ids: selectedHealthConditionIds,
      municipality_id: user?.profile?.municipality_id ?? null,
    barangay_id: user?.profile?.barangay_id ?? null,
    created_by: user?.user_id ?? null,
    };

    setIsSaving(true);

    if (!token || !isAuthenticated) {
      console.log('Submitting child form (no token, test only):', payload);
      setStatusModalTitle('Success');
      setStatusModalMessage('Child payload logged to console (test only).');
      setStatusModalVisible(true);
      setIsSaving(false);
      return;
    }

    try {
      const response = await fetch('http://localhost:8000/api/children', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      console.log('Create child API response:', data);

      if (!response.ok) {
        // Try to surface Laravel validation errors nicely
        let message = 'Failed to save child.';
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
      setStatusModalMessage('Child has been saved successfully.');
      setStatusModalVisible(true);
    } catch (error) {
      console.error('Error saving child:', error);
      setStatusModalTitle('Error');
      setStatusModalMessage('Something went wrong while saving the child.');
      setStatusModalVisible(true);
    } finally {
      setIsSaving(false);
    }
  };

  const renderTextField = (
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    fieldKey?: FieldErrorKey,
    props: any = {},
  ) => (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, fieldKey && errors[fieldKey] && styles.fieldInputError]}
        placeholder={label}
        placeholderTextColor="#9CA3AF"
        value={value}
        onChangeText={text => {
          if (fieldKey) {
            setErrors(prev => ({ ...prev, [fieldKey]: undefined }));
          }
          onChangeText(text);
        }}
        {...props}
      />
      {fieldKey && errors[fieldKey] && (
        <Text style={styles.errorText}>{errors[fieldKey]}</Text>
      )}
    </View>
  );

  const renderDropdownField = (
    label: string,
    value: string,
    onChangeText: (text: string) => void,
  ) => (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity
        activeOpacity={0.8}
        style={styles.dropdownInput}
        onPress={() => {
          // simple text-based input placeholder; you can replace with real picker later
        }}
      >
        <Text style={value ? styles.dropdownValue : styles.dropdownPlaceholder}>
          {value || label}
        </Text>
        <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
              <Ionicons name="chevron-back" size={22} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Add Child</Text>
            <View style={styles.headerRightSpacer} />
          </View>

          {/* Gradient avatar area */}
          <LinearGradient
            colors={['#A8B5FF', '#E879F9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.banner}>
            <View style={styles.avatarCircle}>
              <LinearGradient
                colors={['#60A5FA', '#A855F7']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatarInner}>
                <Ionicons name="person" size={40} color="#FFFFFF" />
              </LinearGradient>
            </View>
          </LinearGradient>

          {/* Form */}
          <ScrollView
            style={styles.formScroll}
            contentContainerStyle={styles.formContent}
            keyboardShouldPersistTaps="handled">
            {renderTextField('First Name', firstName, setFirstName, 'firstName')}
            {renderTextField('Middle Name', middleName, setMiddleName)}
            {renderTextField('Last Name', lastName, setLastName, 'lastName')}
            {renderTextField('Name Extension', nameExtension, setNameExtension)}

            {/* Birthdate (text input so it works on web & native) */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Birthdate</Text>
              <View style={styles.iconInput}>
                <TextInput
                  style={[
                    styles.iconInputText,
                    errors.birthdate && styles.fieldInputError,
                  ]}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9CA3AF"
                  value={birthdate}
                  onChangeText={text => {
                    setErrors(prev => ({ ...prev, birthdate: undefined }));
                    setBirthdate(text);
                  }}
                />
                <Ionicons name="calendar-outline" size={18} color="#9CA3AF" />
              </View>
              {errors.birthdate && (
                <Text style={styles.errorText}>{errors.birthdate}</Text>
              )}
            </View>

            {renderTextField('Weight (kg)', weight, setWeight, 'weight', {
              keyboardType: 'numeric',
            })}
            {renderTextField('Height (cm)', height, setHeight, 'height', {
              keyboardType: 'numeric',
            })}

            {/* Sex selector */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Sex</Text>
              <View style={styles.sexRow}>
                {(['Male', 'Female'] as const).map(option => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.sexOption,
                      sex === option && styles.sexOptionActive,
                    ]}
                    onPress={() => setSex(option)}
                  >
                    <Text
                      style={[
                        styles.sexOptionText,
                        sex === option && styles.sexOptionTextActive,
                      ]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {errors.sex && (
                <Text style={styles.errorText}>{errors.sex}</Text>
              )}
            </View>

            {/* Health Conditions (multi-select from API) */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Health Conditions</Text>
              <TouchableOpacity
                style={styles.dropdownInput}
                activeOpacity={0.8}
                onPress={() => setIsHealthModalVisible(true)}
              >
                <Text
                  style={
                    selectedHealthConditionIds.length
                      ? styles.dropdownValue
                      : styles.dropdownPlaceholder
                  }
                >
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

            {/* Auto-filled Municipality & Barangay from logged-in user */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Municipality</Text>
              <View style={styles.readonlyInput}>
                <Text style={styles.readonlyText}>
                  {user?.profile?.municipality?.municipality_name || '—'}
                </Text>
              </View>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Barangay</Text>
              <View style={styles.readonlyInput}>
                <Text style={styles.readonlyText}>
                  {user?.profile?.barangay?.barangay_name || '—'}
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Buttons */}
          <View style={styles.footerButtons}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, isSaving && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={isSaving}
            >
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
            onRequestClose={() => setIsHealthModalVisible(false)}
          >
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
                        }}
                      >
                        <View
                          style={[
                            styles.checkbox,
                            selected && styles.checkboxSelected,
                          ]}
                        >
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
                    onPress={() => setIsHealthModalVisible(false)}
                  >
                    <Text style={styles.modalCancelText}>Close</Text>
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
            onRequestClose={() => setStatusModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.statusModalContent}>
                <Text
                  style={[
                    styles.statusModalTitle,
                    statusModalTitle === 'Success'
                      ? { color: '#16A34A' }
                      : { color: '#DC2626' },
                  ]}
                >
                  {statusModalTitle}
                </Text>
                <Text style={styles.statusModalMessage}>{statusModalMessage}</Text>
                <TouchableOpacity
                  style={styles.statusModalButton}
                  onPress={() => {
                    setStatusModalVisible(false);
                    if (statusModalTitle === 'Success') {
                      router.replace('/(children)/child-list' as any);
                    }
                  }}
                >
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
  safe: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    width: 24,
  },
  banner: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.25)',
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
  formScroll: {
    flex: 1,
  },
  formContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  fieldGroup: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  fieldInput: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 8,
    fontSize: 14,
    color: '#111827',
  },
  fieldInputError: {
    borderBottomColor: '#DC2626',
  },
  iconInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 8,
  },
  iconInputText: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
  },
  dropdownInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 8,
  },
  dropdownPlaceholder: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  dropdownValue: {
    fontSize: 14,
    color: '#111827',
  },
  readonlyInput: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 8,
  },
  readonlyText: {
    fontSize: 14,
    color: '#6B7280',
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
    backgroundColor: '#8B5CF6',
  },
  statusModalButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  sexRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  sexOption: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  sexOptionActive: {
    borderColor: '#8B5CF6',
    backgroundColor: '#EEF2FF',
  },
  sexOptionText: {
    fontSize: 14,
    color: '#4B5563',
  },
  sexOptionTextActive: {
    color: '#4C1D95',
    fontWeight: '600',
  },
  footerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  cancelButton: {
    flex: 1,
    marginRight: 8,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4B5563',
  },
  saveButton: {
    flex: 1,
    marginLeft: 8,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});


