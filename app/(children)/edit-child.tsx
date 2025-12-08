import { useAuth } from '@/contexts/AuthContext';
import { API_BASE_URL, ChildData, getChildById, getHealthConditions, getNameExtensions, HealthCondition, NameExtension } from '@/lib/api';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
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
  }>();
  const childId = params.childId as string;
  const { token, isAuthenticated, handleTokenInvalidation, user } = useAuth();
  const insets = useSafeAreaInsets();

  const [firstName, setFirstName] = useState((params.firstName as string) || '');
  const [middleName, setMiddleName] = useState((params.middleName as string) || '');
  const [lastName, setLastName] = useState((params.lastName as string) || '');
  const [nameExtensions, setNameExtensions] = useState<NameExtension[]>([]);
  const [nameExtension, setNameExtension] = useState((params.nameExtension as string) || '');
  const [nameExtensionId, setNameExtensionId] = useState<number | null>(null);
  const [nameExtensionLabel, setNameExtensionLabel] = useState('');
  const [nameExtensionOther, setNameExtensionOther] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
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

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isHealthModalVisible, setIsHealthModalVisible] = useState(false);
  const [isNameExtModalVisible, setIsNameExtModalVisible] = useState(false);
  const [confirmationModalVisible, setConfirmationModalVisible] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [statusModalTitle, setStatusModalTitle] = useState<'Success' | 'Error'>('Success');
  const [statusModalMessage, setStatusModalMessage] = useState('');

  type FieldErrorKey = 'firstName' | 'lastName' | 'birthdate' | 'weight' | 'height' | 'sex';
  const [errors, setErrors] = useState<Partial<Record<FieldErrorKey, string>>>({});

  useEffect(() => {
    const loadData = async () => {
      if (!token || !isAuthenticated) {
        setIsLoading(false);
        return;
      }

      try {
        // Load child data to get profile image URL
        if (childId) {
          try {
            const childData: ChildData = await getChildById(token, childId);
            const imagePath = childData.image_path || '';
            const imageUrl = (childData as any).image_url || null;
            
            // Check if image_path contains "default" or is null/empty
            const isDefaultImage = !imagePath || imagePath.toLowerCase().includes('default');
            
            if (isDefaultImage) {
              setProfileImageUrl(null);
              console.log('Image is default or null, showing default icon');
            } else {
              setProfileImageUrl(imageUrl);
              console.log('Loaded profile image URL:', imageUrl);
            }
          } catch (error) {
            console.error('Error loading child data for profile image:', error);
          }
        }

        const [healthList, extList] = await Promise.all([
          getHealthConditions(token),
          getNameExtensions(token),
        ]);
        setHealthConditions(healthList);
        setNameExtensions(extList);

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

    loadData();
  }, [token, isAuthenticated, handleTokenInvalidation, params.healthCondition, childId]);

  // Initialize name extension option vs other text
  useEffect(() => {
    if (!nameExtension) return;
    if (!Array.isArray(nameExtensions) || nameExtensions.length === 0) return;

    const trimmed = String(nameExtension).trim();
    const numericId = Number(trimmed);

    let match: NameExtension | undefined;
    if (!Number.isNaN(numericId)) {
      match = nameExtensions.find(ext => ext.name_extension_id === numericId);
    }
    if (!match) {
      match = nameExtensions.find(
        ext => ext.name_extension.toLowerCase() === trimmed.toLowerCase(),
      );
    }

    if (match) {
      setNameExtensionId(match.name_extension_id);
      setNameExtensionLabel(match.name_extension);
      setNameExtensionOther('');
    } else {
      setNameExtensionId(null);
      setNameExtensionLabel('Other');
      setNameExtensionOther(trimmed);
    }
  }, [nameExtension, nameExtensions]);

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.length) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
      const fileName = asset.uri.split('/').pop() || `child_${Date.now()}.jpg`;
      const extension = fileName.split('.').pop()?.toLowerCase();
      const mimeType =
        extension === 'png'
          ? 'image/png'
          : extension === 'jpg' || extension === 'jpeg'
            ? 'image/jpeg'
            : 'image/jpeg';
    }
  };

  const handleCancel = () => {
    router.back();
  };

  const handleSaveClick = () => {
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
    setConfirmationModalVisible(true);
  };

  const handleConfirmSave = async () => {
    if (isSaving) return;
    setConfirmationModalVisible(false);

    const sex_id = sex === 'Male' ? 1 : sex === 'Female' ? 2 : null;

    const formData = new FormData();
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
    formData.append('updated_by', user?.user_id ? String(user.user_id) : '');
    formData.append('caregiver_first_name', caregiverFirstName);
    formData.append('caregiver_middle_name', caregiverMiddleName);
    formData.append('caregiver_last_name', caregiverLastName);
    if (imageUri) {
      const fileName = imageUri.split('/').pop() || `child_${Date.now()}.jpg`;
      const extension = fileName.split('.').pop()?.toLowerCase();
      const mimeType = extension === 'png' ? 'image/png' : 'image/jpeg';
      
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
      console.log('Submitting child edit (no token, test only): formData prepared');
      setStatusModalTitle('Success');
      setStatusModalMessage('Edit payload logged to console (test only).');
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
      
      // Use fetch with FormData - base64 strings work fine with fetch
      const response = await fetch(`${API_BASE_URL}/api/children/${childId}`, {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: formData as any,
      });

      const responseData = await response.json() as { errors?: Record<string, string[]>; message?: string };
      console.log('Update child API response:', responseData);

      if (!response.ok) {
        let message = 'Failed to update child.';
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
    required?: boolean,
  ) => (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>
        {label}
        {required ? <Text style={styles.requiredAsterisk}> *</Text> : null}
      </Text>
      <TextInput
        style={[
          styles.fieldInput,
          fieldKey && errors[fieldKey] && styles.fieldInputError,
        ]}
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

  if (isLoading || !birthdate) {
    return (
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.safe}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.container}>
            <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
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
          <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
            <TouchableOpacity onPress={handleCancel} style={styles.headerBack}>
              <Ionicons name="chevron-back" size={22} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Edit Child Details</Text>
            <View style={styles.headerRightSpacer} />
          </View>

          {/* Gradient avatar area */}
            <LinearGradient
              colors={["#4FC6D3", "#7B66F5"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.banner}
            >
             <View style={styles.avatarContainer}>
               <TouchableOpacity
                 activeOpacity={0.8}
                 style={styles.avatarCircle}
                 onPress={handlePickImage}
               >
                 {imageUri ? (
                   <Image 
                     source={{ uri: imageUri }} 
                     style={styles.avatarInnerImage}
                     contentFit="cover"
                   />
                 ) : profileImageUrl ? (
                   <Image 
                     source={{ 
                       uri: profileImageUrl,
                       headers: token ? {
                         'Authorization': `Bearer ${token}`,
                       } : undefined,
                     }} 
                     style={styles.avatarInnerImage}
                     contentFit="cover"
                     onError={(error) => {
                       console.error('Error loading profile image:', error);
                     }}
                   />
                 ) : (
                   <LinearGradient
                     colors={["#4FC6D3", "#7B66F5"]}
                     start={{ x: 0, y: 0 }}
                     end={{ x: 1, y: 1 }}
                     style={styles.avatarInner}
                   >
                     <Ionicons name="person" size={40} color="#FFFFFF" />
                   </LinearGradient>
                 )}
               </TouchableOpacity>
               <Text style={styles.uploadHint}>Tap to upload child photo</Text>
             </View>
            </LinearGradient>

          {/* Form */}
          <ScrollView
            style={styles.formScroll}
            contentContainerStyle={styles.formContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.sectionTitle}>Child Information</Text>
            {renderTextField(
              "First Name",
              firstName,
              setFirstName,
              "firstName",
              { placeholder: "e.g., Juan" },
              true
            )}
            {renderTextField("Middle Name", middleName, setMiddleName, undefined, {
              placeholder: "e.g., Santos",
            })}
            {renderTextField("Last Name", lastName, setLastName, "lastName", {
              placeholder: "e.g., Dela Cruz",
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
                      : 'Select extension (optional)'}
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
                    setNameExtension(text);
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

            {/* Sex selector (radio) */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Sex<Text style={styles.requiredAsterisk}> *</Text>
              </Text>
              <View style={styles.radioRow}>
                {(["Male", "Female"] as const).map((option) => {
                  const selected = sex === option;
                  return (
                    <TouchableOpacity
                      key={option}
                      style={styles.radioOption}
                      onPress={() => {
                        setErrors((prev) => ({ ...prev, sex: undefined }));
                        setSex(option);
                      }}
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
              {errors.sex && <Text style={styles.errorText}>{errors.sex}</Text>}
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

            <Text style={styles.sectionTitle}>Current Vital</Text>
            {/* Weight Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Weight (kg)<Text style={styles.requiredAsterisk}> *</Text>
              </Text>
              <View
                style={[
                  styles.numberInputContainer,
                  errors.weight && styles.fieldInputError,
                ]}
              >
                <TextInput
                  style={styles.numberInput}
                  placeholder="e.g., 12.5"
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
              <Text style={styles.fieldLabel}>
                Height (cm)<Text style={styles.requiredAsterisk}> *</Text>
              </Text>
              <View
                style={[
                  styles.numberInputContainer,
                  errors.height && styles.fieldInputError,
                ]}
              >
                <TextInput
                  style={styles.numberInput}
                  placeholder="e.g., 95"
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

            <Text style={styles.sectionTitle}>Caregiver Information</Text>
            {renderTextField(
              'First Name',
              caregiverFirstName,
              setCaregiverFirstName,
              undefined,
              { placeholder: "e.g., Maria" },
            )}
            {renderTextField(
              'Middle Name',
              caregiverMiddleName,
              setCaregiverMiddleName,
              undefined,
              { placeholder: "e.g., Reyes" },
            )}
            {renderTextField(
              'Last Name',
              caregiverLastName,
              setCaregiverLastName,
              undefined,
              { placeholder: "e.g., Santos" },
            )}

            <Text style={styles.sectionTitle}>Health Data</Text>
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
                    : "Select health conditions (multi-select)"}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Buttons */}
          <View style={[styles.footerButtons, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancel}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, isSaving && { opacity: 0.7 }]}
              onPress={handleSaveClick}
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

          {/* Name Extension Modal */}
          <Modal
            visible={isNameExtModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setIsNameExtModalVisible(false)}
          >
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
                    onPress={() => setIsNameExtModalVisible(false)}
                  >
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
            onRequestClose={() => setConfirmationModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.confirmationModalContent}>
                <Text style={styles.confirmationModalTitle}>Confirm Save</Text>
                <Text style={styles.confirmationModalMessage}>
                  Are you sure you want to save these changes?
                </Text>
                <View style={styles.confirmationModalButtons}>
                  <TouchableOpacity
                    style={styles.confirmationModalCancelButton}
                    onPress={() => setConfirmationModalVisible(false)}
                  >
                    <Text style={styles.confirmationModalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.confirmationModalConfirmButton}
                    onPress={handleConfirmSave}
                  >
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
  avatarInnerImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
    resizeMode: 'cover',
  },
  avatarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadHint: {
    fontSize: 12,
    color: '#FFFFFF',
    marginTop: 8,
    opacity: 0.9,
    textAlign: 'center',
  },
  formScroll: {
    flex: 1,
  },
  formContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginTop: 8,
    marginBottom: 8,
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
  requiredAsterisk: {
    color: '#DC2626',
    fontWeight: '700',
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

