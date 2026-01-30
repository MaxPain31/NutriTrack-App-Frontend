import { useAuth } from '@/contexts/AuthContext';
import { HealthCondition, NameExtension, getHealthConditions, getNameExtensions } from '@/lib/api';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AddChildScreen() {
  const { user, token, isAuthenticated, handleTokenInvalidation } = useAuth();
  const insets = useSafeAreaInsets();
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nameExtensionId, setNameExtensionId] = useState<number | null>(null);
  const [nameExtensionLabel, setNameExtensionLabel] = useState('');
  const [nameExtensionOther, setNameExtensionOther] = useState('');
  const [nameExtensions, setNameExtensions] = useState<NameExtension[]>([]);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [birthdate, setBirthdate] = useState<Date | null>(null);
  const [isBirthdatePickerVisible, setIsBirthdatePickerVisible] = useState(false);
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [sex, setSex] = useState<'Male' | 'Female' | ''>('');
  const [healthConditions, setHealthConditions] = useState<HealthCondition[]>([]);
  const [selectedHealthConditionIds, setSelectedHealthConditionIds] = useState<number[]>([]);
  const [isHealthModalVisible, setIsHealthModalVisible] = useState(false);
  const [isNameExtModalVisible, setIsNameExtModalVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [statusModalTitle, setStatusModalTitle] = useState<'Success' | 'Error'>('Success');
  const [statusModalMessage, setStatusModalMessage] = useState('');

  type FieldErrorKey = 'firstName' | 'lastName' | 'birthdate' | 'weight' | 'height' | 'sex';
  const [errors, setErrors] = useState<Partial<Record<FieldErrorKey, string>>>({});

  useEffect(() => {
    const loadMeta = async () => {
      if (!token || !isAuthenticated) return;

      try {
        const [hc, ext] = await Promise.all([
          getHealthConditions(token),
          getNameExtensions(token),
        ]);
        setHealthConditions(hc);
        setNameExtensions(ext);
      } catch (error) {
        console.error('Error loading metadata:', error);
        if (error instanceof Error && error.message === 'TOKEN_INVALIDATED') {
          handleTokenInvalidation();
          return;
        }
      }
    };

    loadMeta();
  }, [token, isAuthenticated, handleTokenInvalidation]);

  const handleCancel = () => {
    router.back();
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.length) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
      const fileName = asset.uri.split('/').pop() || `child_${Date.now()}.jpg`;
      const basePath =
        process.env.EXPO_PUBLIC_FTP_BASE_PATH ||
        'ftp://u961600873.nutritrack@ftp.mostlysunnytech.com/public/assets/images/child_profile/';
      setImagePath(`${basePath}${fileName}`);
    }
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

    const formData = new FormData();
    const sex_id = sex === 'Male' ? 1 : sex === 'Female' ? 2 : null;
    formData.append('child_first_name', firstName);
    formData.append('child_middle_name', middleName || '');
    formData.append('child_last_name', lastName);
    if (nameExtensionId !== null) {
      formData.append('name_extension_id', String(nameExtensionId));
    } else if (nameExtensionLabel === 'Other' && nameExtensionOther.trim()) {
      formData.append('name_extension_name', nameExtensionOther.trim());
    } else {
      formData.append('name_extension_id', '');
    }
    formData.append('child_birthdate', (birthdate as Date).toISOString().split('T')[0]);
    formData.append('weight', weight);
    formData.append('height', height);
    if (sex_id !== null) formData.append('sex_id', String(sex_id));
    selectedHealthConditionIds.forEach(id =>
      formData.append('health_condition_ids[]', String(id)),
    );
    formData.append(
      'municipality_id',
      user?.profile?.municipality_id ? String(user.profile.municipality_id) : '',
    );
    formData.append(
      'barangay_id',
      user?.profile?.barangay_id ? String(user.profile.barangay_id) : '',
    );
    formData.append('created_by', user?.user_id ? String(user.user_id) : '');
    if (imageUri) {
      const fileName = imageUri.split('/').pop() || `child_${Date.now()}.jpg`;
      const extension = fileName.split('.').pop()?.toLowerCase();
      const mimeType =
        extension === 'png'
          ? 'image/png'
          : extension === 'jpg' || extension === 'jpeg'
            ? 'image/jpeg'
            : 'image/jpeg';
      
      // Convert image to base64 as workaround for React Native FormData bug
      try {
        console.log('Converting image to base64, URI:', imageUri);
        let base64: string;
        
        if (Platform.OS === 'web') {
          // Web platform: use fetch and FileReader
          const response = await fetch(imageUri);
          const blob = await response.blob();
          base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = reader.result as string;
              // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
              const base64Data = result.split(',')[1];
              resolve(base64Data);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } else {
          // Native platform: use expo-file-system
          base64 = await FileSystem.readAsStringAsync(imageUri, {
            encoding: 'base64' as any,
          });
        }
        
        console.log('Image converted to base64, length:', base64.length);
        console.log('Base64 first 50 chars:', base64.substring(0, 50));
        console.log('Base64 type:', typeof base64);
        
        // Send base64 as profile_image field - backend should detect and handle base64
        // Ensure it's a string and append directly
        const base64String = String(base64);
        console.log('Base64String type after String():', typeof base64String);
        formData.append('profile_image', base64String);
        formData.append('profile_image_name', fileName);
        formData.append('profile_image_type', mimeType);
        formData.append('profile_image_is_base64', 'true');
      } catch (error) {
        console.error('Error converting image to base64:', error);
        // Don't send fallback - let backend know image upload failed
        formData.append('profile_image_error', 'Failed to convert image to base64');
      }
    }

    setIsSaving(true);

    if (!token || !isAuthenticated) {
      console.log('Submitting child form (no token, test only): formData prepared');
      setStatusModalTitle('Success');
      setStatusModalMessage('Child payload logged to console (test only).');
      setStatusModalVisible(true);
      setIsSaving(false);
      return;
    }

    try {
      // Log FormData contents for debugging
      console.log('FormData contents:');
      const formDataEntries: any[] = [];
      (formData as any)._parts?.forEach((part: any) => {
        if (Array.isArray(part) && part.length >= 2) {
          const [key, value] = part;
          if (key === 'profile_image') {
            console.log('profile_image value type:', typeof value);
            console.log('profile_image value is string:', typeof value === 'string');
            console.log('profile_image value length:', typeof value === 'string' ? value.length : 'N/A');
            if (typeof value === 'string' && value.length > 100) {
              formDataEntries.push([key, `[base64 string, length: ${value.length}, first 50: ${value.substring(0, 50)}]`]);
            } else {
              formDataEntries.push([key, `[${typeof value}: ${JSON.stringify(value).substring(0, 100)}]`]);
            }
          } else {
            formDataEntries.push([key, typeof value === 'object' ? JSON.stringify(value) : value]);
          }
        }
      });
      console.log('FormData entries:', formDataEntries);
      console.log('Sending FormData to:', "http://72.60.236.137:8002/api/children");
      
      // Use fetch with FormData - base64 strings work fine with fetch
      // Note: Do NOT set Content-Type header - fetch will set it automatically with boundary
      const response = await fetch("http://72.60.236.137:8002/api/children", {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
          // Content-Type will be set automatically by fetch for FormData
        },
        body: formData as any, // TypeScript workaround for React Native FormData
      });
      
      console.log('Response status:', response.status);
      console.log('Response headers:', JSON.stringify(Object.fromEntries(response.headers.entries())));

      const responseData = await response.json() as { errors?: Record<string, string[]>; message?: string };
      console.log('Create child API response:', responseData);

      if (!response.ok) {
        // Try to surface Laravel validation errors nicely
        let message = 'Failed to save child.';
        if (responseData && responseData.errors) {
          const firstKey = Object.keys(responseData.errors)[0];
          const firstMsgArr = responseData.errors[firstKey];
          message =
            Array.isArray(firstMsgArr) && firstMsgArr.length > 0
              ? firstMsgArr[0]
              : responseData.message || 'Validation failed.';
        } else if (responseData && responseData.message) {
          message = responseData.message;
        }
        setStatusModalTitle('Error');
        setStatusModalMessage(message);
        setStatusModalVisible(true);
        setIsSaving(false);
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
    required?: boolean,
  ) => (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>
        {label}
        {required ? <Text style={styles.requiredAsterisk}> *</Text> : null}
      </Text>
      <TextInput
        style={[styles.fieldInput, fieldKey && errors[fieldKey] && styles.fieldInputError]}
        placeholder={props.placeholder || label}
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
          <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
              <Ionicons name="chevron-back" size={22} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Add Child</Text>
            <View style={styles.headerRightSpacer} />
          </View>

          {/* Gradient avatar area with upload */}
          <LinearGradient
            colors={['#4FC6D3', '#7B66F5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.banner}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.avatarCircle}
              onPress={handlePickImage}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.avatarInnerImage} />
              ) : (
                <LinearGradient
                  colors={['#4FC6D3', '#7B66F5']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.avatarInner}>
                  <Ionicons name="person" size={40} color="#FFFFFF" />
                </LinearGradient>
              )}
            </TouchableOpacity>
            <Text style={styles.avatarHint}>Tap to upload child photo</Text>
          </LinearGradient>

          {/* Form */}
          <ScrollView
            style={styles.formScroll}
            contentContainerStyle={styles.formContent}
            keyboardShouldPersistTaps="handled">
            {renderTextField('First Name', firstName, setFirstName, 'firstName', {
              placeholder: 'e.g., Juan',
            }, true)}
            {renderTextField('Middle Name', middleName, setMiddleName, undefined, {
              placeholder: 'e.g., Santos',
            })}
            {renderTextField('Last Name', lastName, setLastName, 'lastName', {
              placeholder: 'e.g., Dela Cruz',
            }, true)}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Name Extension</Text>
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.dropdownInput}
                onPress={() => setIsNameExtModalVisible(true)}>
                <Text
                  style={
                    nameExtensionId || nameExtensionLabel || nameExtensionOther
                      ? styles.dropdownValue
                      : styles.dropdownPlaceholder
                  }>
                  {nameExtensionId
                    ? nameExtensionLabel
                    : nameExtensionOther
                      ? `Other: ${nameExtensionOther}`
                      : 'Select extension (optional, e.g., Jr., Sr., II)'}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
              </TouchableOpacity>
              {nameExtensionLabel === 'Other' && (
                <TextInput
                  style={[styles.fieldInput, { marginTop: 8 }]}
                  placeholder="Enter other extension (e.g., Jr., Sr., II)"
                  placeholderTextColor="#9CA3AF"
                  value={nameExtensionOther}
                  onChangeText={text => {
                    setNameExtensionOther(text);
                  }}
                />
              )}
            </View>

            {/* Birthdate */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Birthdate<Text style={styles.requiredAsterisk}> *</Text>
              </Text>
              <TouchableOpacity
                activeOpacity={0.8}
                style={[
                  styles.iconInput,
                  errors.birthdate && styles.fieldInputError,
                ]}
                onPress={() => setIsBirthdatePickerVisible(true)}
              >
                <Text style={styles.iconInputText}>
                  {birthdate ? birthdate.toLocaleDateString() : 'Select birthdate'}
                </Text>
                <Ionicons name="calendar-outline" size={18} color="#9CA3AF" />
              </TouchableOpacity>
              {errors.birthdate && (
                <Text style={styles.errorText}>{errors.birthdate}</Text>
              )}
              {isBirthdatePickerVisible && (
                <DateTimePicker
                  value={birthdate || new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, selectedDate) => {
                    if (event.type === 'dismissed') {
                      setIsBirthdatePickerVisible(false);
                      return;
                    }
                    if (selectedDate) {
                      setErrors(prev => ({ ...prev, birthdate: undefined }));
                      setBirthdate(selectedDate);
                    }
                    if (Platform.OS !== 'ios') {
                      setIsBirthdatePickerVisible(false);
                    }
                  }}
                />
              )}
            </View>

            {renderTextField('Weight (kg)', weight, setWeight, 'weight', {
              keyboardType: 'numeric',
              placeholder: 'e.g., 12.5',
            }, true)}
            {renderTextField('Height (cm)', height, setHeight, 'height', {
              keyboardType: 'numeric',
              placeholder: 'e.g., 95',
            }, true)}

            {/* Sex selector (radio) */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Sex<Text style={styles.requiredAsterisk}> *</Text>
              </Text>
              <View style={styles.radioRow}>
                {(['Male', 'Female'] as const).map(option => {
                  const selected = sex === option;
                  return (
                    <TouchableOpacity
                      key={option}
                      style={styles.radioOption}
                      onPress={() => setSex(option)}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.radioOuter, selected && styles.radioOuterActive]}>
                        {selected && <View style={styles.radioInner} />}
                      </View>
                      <Text style={styles.radioLabel}>{option}</Text>
                    </TouchableOpacity>
                  );
                })}
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
          <View style={[styles.footerButtons, { paddingBottom: Math.max(insets.bottom, 20) }]}>
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

          {/* Name Extension Modal */}
          <Modal
            visible={isNameExtModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setIsNameExtModalVisible(false)}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Select Extension</Text>
                <ScrollView style={styles.modalList}>
                  {nameExtensions.map(option => {
                    const isSelected = nameExtensionId === option.name_extension_id;
                    return (
                      <TouchableOpacity
                        key={option.name_extension_id}
                        style={styles.modalOption}
                        onPress={() => {
                          setNameExtensionId(option.name_extension_id);
                          setNameExtensionLabel(option.name_extension);
                          setNameExtensionOther('');
                          setIsNameExtModalVisible(false);
                        }}>
                        <View
                          style={[
                            styles.checkbox,
                            isSelected && styles.checkboxSelected,
                          ]}>
                          {isSelected && (
                            <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                          )}
                        </View>
                        <Text style={styles.modalOptionText}>{option.name_extension}</Text>
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity
                    style={styles.modalOption}
                    onPress={() => {
                      setNameExtensionId(null);
                      setNameExtensionLabel('Other');
                      setIsNameExtModalVisible(false);
                    }}>
                    <View
                      style={[
                        styles.checkbox,
                        nameExtensionLabel === 'Other' && styles.checkboxSelected,
                      ]}>
                      {nameExtensionLabel === 'Other' && (
                        <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                      )}
                    </View>
                    <Text style={styles.modalOptionText}>Other</Text>
                  </TouchableOpacity>
                </ScrollView>
                <View style={styles.modalFooter}>
                  <TouchableOpacity
                    style={styles.modalCancelButton}
                    onPress={() => setIsNameExtModalVisible(false)}>
                    <Text style={styles.modalCancelText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

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
                      // Navigate back to child-list and force reload
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
  avatarInnerImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
    resizeMode: 'cover',
  },
  avatarHint: {
    marginTop: 8,
    fontSize: 12,
    color: '#F9FAFB',
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
  requiredAsterisk: {
    color: '#DC2626',
    fontWeight: '700',
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
  radioRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 4,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#9CA3AF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  radioOuterActive: {
    borderColor: '#8B5CF6',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#8B5CF6',
  },
  radioLabel: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  footerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
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


