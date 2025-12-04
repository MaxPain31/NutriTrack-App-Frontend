import { useAuth } from '@/contexts/AuthContext';
import { HealthCondition, getHealthConditions } from '@/lib/api';
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

export default function EditChildScreen() {
  const params = useLocalSearchParams<{
    childId?: string;
    firstName?: string;
    middleName?: string;
    lastName?: string;
    nameExtension?: string;
    birthdate?: string;
    weight?: string;
    height?: string;
    sex?: string;
    healthCondition?: string;
    barangayName?: string;
    municipalityName?: string;
    caregiverFirstName?: string;
    caregiverMiddleName?: string;
    caregiverLastName?: string;
    caregiverExtension?: string;
  }>();
  const childId = params.childId as string;
  const { token, isAuthenticated, handleTokenInvalidation, user } = useAuth();

  const [firstName, setFirstName] = useState((params.firstName as string) || '');
  const [middleName, setMiddleName] = useState((params.middleName as string) || '');
  const [lastName, setLastName] = useState((params.lastName as string) || '');
  const [nameExtension, setNameExtension] = useState((params.nameExtension as string) || '');
  const [birthdate, setBirthdate] = useState<Date | null>(
    params.birthdate ? new Date(params.birthdate as string) : null,
  );
  const [isBirthdatePickerVisible, setIsBirthdatePickerVisible] = useState(false);
  const [weight, setWeight] = useState((params.weight as string) || '');
  const [height, setHeight] = useState((params.height as string) || '');
  const [sex, setSex] = useState<'Male' | 'Female' | ''>(
    (params.sex as 'Male' | 'Female' | '') || '',
  );
  const [healthConditions, setHealthConditions] = useState<HealthCondition[]>([]);
  const [selectedHealthConditionIds, setSelectedHealthConditionIds] = useState<number[]>([]);
  const [caregiverFirstName, setCaregiverFirstName] = useState(
    (params.caregiverFirstName as string) || '',
  );
  const [caregiverMiddleName, setCaregiverMiddleName] = useState(
    (params.caregiverMiddleName as string) || '',
  );
  const [caregiverLastName, setCaregiverLastName] = useState(
    (params.caregiverLastName as string) || '',
  );
  const [caregiverExtension, setCaregiverExtension] = useState(
    (params.caregiverExtension as string) || '',
  );

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isHealthModalVisible, setIsHealthModalVisible] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [statusModalTitle, setStatusModalTitle] = useState<'Success' | 'Error'>('Success');
  const [statusModalMessage, setStatusModalMessage] = useState('');

  type FieldErrorKey = 'firstName' | 'lastName' | 'birthdate' | 'weight' | 'height' | 'sex';
  const [errors, setErrors] = useState<Partial<Record<FieldErrorKey, string>>>({});

  useEffect(() => {
    const loadHealthConditions = async () => {
      if (!token || !isAuthenticated) {
        setIsLoading(false);
        return;
      }

      try {
        const healthList = await getHealthConditions(token);
        setHealthConditions(healthList);

        // Preselect based on names passed from child-details (comma-separated)
        const conditionNames =
          (params.healthCondition as string | undefined)
            ?.split(',')
            .map(name => name.trim().toLowerCase())
            .filter(Boolean) || [];

        if (conditionNames.length > 0) {
          const ids = healthList
            .filter(hc => conditionNames.includes(hc.condition_name.toLowerCase()))
            .map(hc => hc.health_condition_id);
          setSelectedHealthConditionIds(ids);
        }
      } catch (error) {
        console.error('Error loading health conditions:', error);
        if (error instanceof Error && error.message === 'TOKEN_INVALIDATED') {
          handleTokenInvalidation();
          return;
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadHealthConditions();
  }, [token, isAuthenticated, handleTokenInvalidation, params.healthCondition]);

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
    if (!birthdate) {
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

    const sex_id = sex === 'Male' ? 1 : sex === 'Female' ? 2 : null;

    const payload = {
      child_first_name: firstName,
      child_middle_name: middleName || null,
      child_last_name: lastName,
      name_extension_id: nameExtension || null,
      child_birthdate: (birthdate as Date).toISOString().split('T')[0],
      weight,
      height,
      sex_id,
      health_condition_ids: selectedHealthConditionIds,
      municipality_id: user?.profile?.municipality_id ?? null,
      barangay_id: user?.profile?.barangay_id ?? null,
      updated_by: user?.user_id ?? null,
      caregiver_first_name: caregiverFirstName,
      caregiver_middle_name: caregiverMiddleName,
      caregiver_last_name: caregiverLastName,
      caregiver_name_extension: caregiverExtension,
    };

    setIsSaving(true);

    if (!token || !isAuthenticated) {
      console.log('Submitting child edit (no token, test only):', payload);
      setStatusModalTitle('Success');
      setStatusModalMessage('Edit payload logged to console (test only).');
      setStatusModalVisible(true);
      setIsSaving(false);
      return;
    }

    try {
      const response = await fetch(`http://localhost:8000/api/children/${childId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      console.log('Update child API response:', data);

      if (!response.ok) {
        let message = 'Failed to update child.';
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
      setStatusModalMessage('Child details have been updated successfully.');
      setStatusModalVisible(true);
    } catch (error) {
      console.error('Error updating child:', error);
      setStatusModalTitle('Error');
      setStatusModalMessage('Something went wrong while updating the child.');
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
        style={[
          styles.fieldInput,
          fieldKey && errors[fieldKey] && styles.fieldInputError,
        ]}
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

  if (isLoading || !birthdate) {
    return (
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.safe}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.container}>
            <View style={styles.header}>
              <TouchableOpacity onPress={handleCancel} style={styles.headerBack}>
                <Ionicons name="chevron-back" size={22} color="#111827" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Edit Child Details</Text>
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
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleCancel} style={styles.headerBack}>
              <Ionicons name="chevron-back" size={22} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Edit Child Details</Text>
            <View style={styles.headerRightSpacer} />
          </View>

          {/* Gradient avatar area */}
          <LinearGradient
            colors={["#60A5FA", "#A855F7"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.banner}
          >
            <View style={styles.avatarCircle}>
              <LinearGradient
                colors={["#60A5FA", "#A855F7"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatarInner}
              >
                <Ionicons name="person" size={40} color="#FFFFFF" />
              </LinearGradient>
            </View>
          </LinearGradient>

          {/* Form */}
          <ScrollView
            style={styles.formScroll}
            contentContainerStyle={styles.formContent}
            keyboardShouldPersistTaps="handled"
          >
            {renderTextField(
              "First Name",
              firstName,
              setFirstName,
              "firstName"
            )}
            {renderTextField("Middle Name", middleName, setMiddleName)}
            {renderTextField("Last Name", lastName, setLastName, "lastName")}
            {renderTextField("Name Extension", nameExtension, setNameExtension)}

            {/* Birthdate */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Birthdate</Text>
              <TouchableOpacity
                activeOpacity={0.8}
                style={[
                  styles.iconInput,
                  errors.birthdate && styles.fieldInputError,
                ]}
                onPress={() => setIsBirthdatePickerVisible(true)}
              >
                <Text style={styles.iconInputText}>
                  {birthdate.toLocaleDateString()}
                </Text>
                <Ionicons name="calendar-outline" size={18} color="#9CA3AF" />
              </TouchableOpacity>
              {errors.birthdate && (
                <Text style={styles.errorText}>{errors.birthdate}</Text>
              )}
              {isBirthdatePickerVisible && (
                <DateTimePicker
                  value={birthdate}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={(event, selectedDate) => {
                    if (event.type === "dismissed") {
                      setIsBirthdatePickerVisible(false);
                      return;
                    }
                    if (selectedDate) {
                      setErrors((prev) => ({ ...prev, birthdate: undefined }));
                      setBirthdate(selectedDate);
                    }
                    if (Platform.OS !== "ios") {
                      setIsBirthdatePickerVisible(false);
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
                ]}
              >
                <TextInput
                  style={styles.numberInput}
                  placeholder="0.0"
                  placeholderTextColor="#9CA3AF"
                  value={weight}
                  onChangeText={(text) => {
                    setErrors((prev) => ({ ...prev, weight: undefined }));
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
                ]}
              >
                <TextInput
                  style={styles.numberInput}
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                  value={height}
                  onChangeText={(text) => {
                    setErrors((prev) => ({ ...prev, height: undefined }));
                    setHeight(text);
                  }}
                  keyboardType="number-pad"
                />
              </View>
              {errors.height && (
                <Text style={styles.errorText}>{errors.height}</Text>
              )}
            </View>

            {/* Sex selector */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Sex</Text>
              <View style={styles.sexRow}>
                {(["Male", "Female"] as const).map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.sexOption,
                      sex === option && styles.sexOptionActive,
                    ]}
                    onPress={() => {
                      setErrors((prev) => ({ ...prev, sex: undefined }));
                      setSex(option);
                    }}
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
              {errors.sex && <Text style={styles.errorText}>{errors.sex}</Text>}
            </View>

            {/* Health Conditions (multi-select from API) */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Health Conditions</Text>
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.dropdownInput}
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
                        .filter((hc) =>
                          selectedHealthConditionIds.includes(
                            hc.health_condition_id
                          )
                        )
                        .map((hc) => hc.condition_name)
                        .join(", ")
                    : "Select health conditions"}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* Municipality (read-only) */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Municipality</Text>
              <View style={styles.readonlyInput}>
                <Text style={styles.readonlyText}>
                  {(params.municipalityName as string) || "—"}
                </Text>
              </View>
            </View>

            {/* Barangay (read-only) */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Barangay</Text>
              <View style={styles.readonlyInput}>
                <Text style={styles.readonlyText}>
                  {(params.barangayName as string) || "—"}
                </Text>
              </View>
            </View>

            {/* Caregiver Name - First, Middle, Last, Extension */}
            {renderTextField(
              'Caregiver First Name',
              caregiverFirstName,
              setCaregiverFirstName,
            )}
            {renderTextField(
              'Caregiver Middle Name',
              caregiverMiddleName,
              setCaregiverMiddleName,
            )}
            {renderTextField(
              'Caregiver Last Name',
              caregiverLastName,
              setCaregiverLastName,
            )}
            {renderTextField(
              'Caregiver Name Extension',
              caregiverExtension,
              setCaregiverExtension,
            )}
          </ScrollView>

          {/* Buttons */}
          <View style={styles.footerButtons}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancel}
            >
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
                  {healthConditions.map((condition) => {
                    const selected = selectedHealthConditionIds.includes(
                      condition.health_condition_id
                    );
                    return (
                      <TouchableOpacity
                        key={condition.health_condition_id}
                        style={styles.modalOption}
                        onPress={() => {
                          setSelectedHealthConditionIds((prev) => {
                            if (prev.includes(condition.health_condition_id)) {
                              return prev.filter(
                                (id) => id !== condition.health_condition_id
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
                    statusModalTitle === "Success"
                      ? { color: "#16A34A" }
                      : { color: "#DC2626" },
                  ]}
                >
                  {statusModalTitle}
                </Text>
                <Text style={styles.statusModalMessage}>
                  {statusModalMessage}
                </Text>
                <TouchableOpacity
                  style={styles.statusModalButton}
                  onPress={() => {
                    setStatusModalVisible(false);
                    if (statusModalTitle === "Success") {
                      router.replace({
                        pathname: "/(children)/child-details",
                        params: { id: childId },
                      } as any);
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
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 8,
    paddingRight: 8,
  },
  iconInputText: {
    flex: 1,
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
  numberInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 8,
  },
  numberInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    paddingRight: 8,
  },
  numberInputButtons: {
    flexDirection: 'column',
    gap: 4,
  },
  numberButton: {
    padding: 4,
  },
  dropdownInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 8,
    paddingRight: 8,
  },
  dropdownPlaceholder: {
    fontSize: 14,
    color: '#9CA3AF',
    flex: 1,
  },
  dropdownValue: {
    fontSize: 14,
    color: '#111827',
    flex: 1,
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
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
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
    fontWeight: '600',
    color: '#FFFFFF',
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
    backgroundColor: '#9333EA',
  },
  statusModalButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

