import { useAuth } from '@/contexts/AuthContext';
import { ChildData, getChildren } from '@/lib/api';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Child {
  id: string;
  name: string;
  ageMonths: number;
  birthdate: string;
  height: number;
  weight: number;
  weightForHeight: string;
  weightForAge: string;
  heightForAge: string;
  sex?: string;
  address?: string;
  updated?: string;
   activeIntervention?: string | null;
   healthCondition?: string | null;
}

const toTitleCase = (value: string) =>
  value
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map(word => word[0].toUpperCase() + word.slice(1))
    .join(' ');

export default function ChildListScreen() {
  const { isAuthenticated, isLoading, logout, token, handleTokenInvalidation, user } = useAuth();
  const insets = useSafeAreaInsets();
  
  // Child list state
  const [children, setChildren] = useState<Child[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedChildren, setSelectedChildren] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [currentView, setCurrentView] = useState('Weight for Height');
  const [currentPage, setCurrentPage] = useState(1);
  const [goToValue, setGoToValue] = useState('1');
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoadingChildren, setIsLoadingChildren] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isItemsPerPageDropdownOpen, setIsItemsPerPageDropdownOpen] = useState(false);
  const itemsPerPageButtonRef = useRef<View>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0 });
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [statusFilterLabel, setStatusFilterLabel] = useState('All');
  const [wfaId, setWfaId] = useState<number | undefined>(undefined);
  const [wfhId, setWfhId] = useState<number | undefined>(undefined);
  const [hfaId, setHfaId] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login' as any);
    }
  }, [isAuthenticated, isLoading]);

  // Keep Go To field in sync with current page
  useEffect(() => {
    setGoToValue(currentPage.toString());
  }, [currentPage]);

  // Debounce search query to avoid API spamming
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500); // 500ms delay

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset to page 1 when search query, items per page, or filters change
  useEffect(() => {
    if (isAuthenticated && token) {
      setCurrentPage(1);
    }
  }, [debouncedSearchQuery, itemsPerPage, wfaId, wfhId, hfaId, isAuthenticated, token]);

  // Fetch children data from API
  useEffect(() => {
    if (isAuthenticated && token && user?.profile?.barangay_id) {
      fetchChildren();
    }
  }, [currentPage, itemsPerPage, debouncedSearchQuery, wfaId, wfhId, hfaId, isAuthenticated, token, user?.profile?.barangay_id]);

  const fetchChildren = async () => {
    if (!token || !isAuthenticated || !user?.profile?.barangay_id) {
      return;
    }

    setIsLoadingChildren(true);
    try {
      const response = await getChildren(
        token,
        currentPage,
        itemsPerPage,
        debouncedSearchQuery || undefined,
        user.profile.barangay_id,
        0,
        wfaId,
        wfhId,
        hfaId
      );

      // Map API response to component format
      const mappedChildren: Child[] = response.children.map((child: ChildData) => {
        // Format full name with extension
        const middleInitial = child.child_middle_name
          ? `${child.child_middle_name.charAt(0).toUpperCase()}. `
          : '';
        const rawNameExtension = (child as any).name_extension;
        const nameExtensionLabel =
          (rawNameExtension && rawNameExtension.name_extension) ||
          (child as any)?.name_extension_name ||
          null;
        // Apply toTitleCase only to name parts, preserve extension case
        const firstName = toTitleCase(child.child_first_name);
        const lastName = toTitleCase(child.child_last_name);
        const fullName = `${firstName} ${middleInitial}${lastName}${nameExtensionLabel ? ` ${nameExtensionLabel}` : ''}`;
        const displayName = fullName;

        // Sex and address
        const sex = child.sex?.sex || '';
        const barangayName = child.barangay?.barangay_name;
        const municipalityName = child.municipality?.municipality_name;
        const address =
          barangayName && municipalityName
            ? `${barangayName}, ${municipalityName}`
            : undefined;

        // All interventions / health conditions, joined by comma
        const interventionsList =
          child.interventions && child.interventions.length > 0
            ? child.interventions
                .map(i => i.intervention?.intervention_name)
                .filter(Boolean)
                .join(', ')
            : null;

        const healthConditionsList =
          child.health_conditions && child.health_conditions.length > 0
            ? child.health_conditions
                .map(h => h.health_condition?.condition_name)
                .filter(Boolean)
                .join(', ')
            : null;

        return {
          id: child.child_id,
          name: displayName,
          ageMonths: child.age,
          birthdate: child.child_birthdate,
          height: parseFloat(child.height) || 0,
          weight: parseFloat(child.weight) || 0,
          weightForHeight: normalizeStatus(child.wfh?.wfh_status),
          weightForAge: normalizeStatus(child.wfa?.wfa_status),
          heightForAge: normalizeStatus(child.hfa?.hfa_status),
          sex,
          address,
          updated: child.child_updated_at || undefined,
          activeIntervention: interventionsList,
          healthCondition: healthConditionsList,
        };
      });

      setChildren(mappedChildren);
      setTotalItems(response.pagination.total);
    } catch (error) {
      console.error('Error fetching children:', error);
      if (error instanceof Error && error.message === 'TOKEN_INVALIDATED') {
        handleTokenInvalidation();
        return;
      }
      Alert.alert('Error', 'Failed to load children data');
    } finally {
      setIsLoadingChildren(false);
    }
  };

  // Selection handlers
  const handleLongPress = (childId: string) => {
    setIsSelectionMode(true);
    setSelectedChildren(new Set([childId]));
  };

  const handleCardPress = (childId: string) => {
    if (isSelectionMode) {
      const newSelected = new Set(selectedChildren);
      if (newSelected.has(childId)) {
        newSelected.delete(childId);
      } else {
        newSelected.add(childId);
      }
      setSelectedChildren(newSelected);
      if (newSelected.size === 0) {
        setIsSelectionMode(false);
      }
    } else {
      // Navigate to child details when not in selection mode
      router.push({
        pathname: '/(children)/child-details',
        params: { id: childId },
      } as any);
    }
  };

  const normalizeStatus = (status?: string | null) => {
    const trimmed = (status || '').trim();
    if (!trimmed) return 'Unknown';
    return trimmed.toLowerCase() === 'error' ? 'Out of Range' : trimmed;
  };

  const handleSelectAll = () => {
    if (selectedChildren.size === children.length) {
      setSelectedChildren(new Set());
      setIsSelectionMode(false);
    } else {
      setSelectedChildren(new Set(children.map(child => child.id)));
    }
  };

  const handleCancelSelection = () => {
    setSelectedChildren(new Set());
    setIsSelectionMode(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Normal':
        return '#10B981';
      case 'Underweight':
        return '#F59E0B';
      case 'Overweight':
      case 'Obese':
        return '#EF4444';
      case 'Stunted':
      case 'Severely Stunted':
        return '#EF4444';
      case 'Out of Range':
        return '#6B7280';
      default:
        return '#6B7280';
    }
  };

  const totalPages = Math.ceil(totalItems / itemsPerPage || 1);
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  // Mapping of status labels to their IDs
  const statusIdMap: Record<string, { wfaId?: number; wfhId?: number; hfaId?: number }> = {
    'Severely Acute': { wfhId: 1 },
    'Moderately Wasted': { wfhId: 2 },
    'Normal (WFH)': { wfhId: 3 },
    'Overweight': { wfhId: 4 },
    'Obese': { wfhId: 5 },
    'Severely Underweight': { wfaId: 1 },
    'Underweight': { wfaId: 2 },
    'Normal (WFA)': { wfaId: 3 },
    'Severely Stunted': { hfaId: 1 },
    'Stunted': { hfaId: 2 },
    'Normal (HFA)': { hfaId: 3 },
    'Tall': { hfaId: 4 },
  };

  const statusOptions: {
    type: 'header' | 'item';
    label: string;
    group?: 'Weight for Height' | 'Weight for Age' | 'Height for Age';
  }[] = [
    { type: 'item', label: 'All Status' },
    { type: 'header', label: 'Weight for Height' },
    { type: 'item', label: 'Severely Acute', group: 'Weight for Height' },
    { type: 'item', label: 'Moderately Wasted', group: 'Weight for Height' },
    { type: 'item', label: 'Normal (WFH)', group: 'Weight for Height' },
    { type: 'item', label: 'Overweight', group: 'Weight for Height' },
    { type: 'item', label: 'Obese', group: 'Weight for Height' },
    { type: 'header', label: 'Weight for Age' },
    { type: 'item', label: 'Severely Underweight', group: 'Weight for Age' },
    { type: 'item', label: 'Underweight', group: 'Weight for Age' },
    { type: 'item', label: 'Normal (WFA)', group: 'Weight for Age' },
    { type: 'header', label: 'Height for Age' },
    { type: 'item', label: 'Severely Stunted', group: 'Height for Age' },
    { type: 'item', label: 'Stunted', group: 'Height for Age' },
    { type: 'item', label: 'Normal (HFA)', group: 'Height for Age' },
    { type: 'item', label: 'Tall', group: 'Height for Age' },
  ];

  const handleStatusSelect = (option: { type: 'header' | 'item'; label: string; group?: 'Weight for Height' | 'Weight for Age' | 'Height for Age' }) => {
    if (option.type === 'header') {
      return;
    }
    if (option.label === 'All Status') {
      setStatusFilterLabel('All');
      setCurrentView('Weight for Height');
      setWfaId(undefined);
      setWfhId(undefined);
      setHfaId(undefined);
    } else if (option.group) {
      setStatusFilterLabel(option.label);
      setCurrentView(option.group);
      const statusIds = statusIdMap[option.label];
      if (statusIds) {
        setWfaId(statusIds.wfaId);
        setWfhId(statusIds.wfhId);
        setHfaId(statusIds.hfaId);
      }
    }
    setIsStatusDropdownOpen(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.layout}>
        <View style={styles.content}>
          <View style={[styles.topHeader, { paddingTop: Math.max(insets.top, 20) }]}>
            <View style={styles.topHeaderLeft}>
              <View style={styles.topHeaderBrand}>
                <Text style={styles.topHeaderBrandTextPrimary}>Nutri</Text>
                <Text style={styles.topHeaderBrandTextAccent}>Track</Text>
              </View>
              {!!user?.profile?.barangay?.barangay_name && (
                <View style={styles.topHeaderLocationPill}>
                  <Ionicons name="location-outline" size={14} color="#2563EB" />
                  <Text style={styles.topHeaderLocationText}>
                    {user.profile.barangay.barangay_name}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.topHeaderProfileContainer}>
              <TouchableOpacity
                style={styles.topHeaderProfileWrapper}
                onPress={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
              >
                <LinearGradient
                  colors={["#60A5FA", "#A855F7"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.topHeaderProfileCircle}
                >
                  <Ionicons name="person" size={18} color="#FFFFFF" />
                </LinearGradient>
              </TouchableOpacity>

              <Modal
                visible={isProfileDropdownOpen}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsProfileDropdownOpen(false)}
              >
                <TouchableOpacity
                  style={styles.dropdownOverlay}
                  activeOpacity={1}
                  onPress={() => setIsProfileDropdownOpen(false)}
                >
                  <View style={styles.profileDropdownContainer}>
                    <View style={styles.profileDropdown}>
                      <Text style={styles.dropdownHeader}>ACCOUNT</Text>
                      <TouchableOpacity
                        style={styles.dropdownItem}
                        onPress={() => {
                          setIsProfileDropdownOpen(false);
                          router.push("/(children)/profile-setting" as any);
                        }}
                      >
                        <Ionicons
                          name="person-outline"
                          size={18}
                          color="#9CA3AF"
                        />
                        <Text style={styles.dropdownItemText}>
                          Profile Setting
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.dropdownItem}
                        onPress={async () => {
                          setIsProfileDropdownOpen(false);
                          await logout();
                        }}
                      >
                        <Ionicons
                          name="log-out-outline"
                          size={18}
                          color="#9CA3AF"
                        />
                        <Text style={styles.dropdownItemText}>Log Out</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              </Modal>
            </View>
          </View>
          <View style={styles.contentBody}>
            <ScrollView style={styles.scrollArea}>
              {/* Banner */}
              <LinearGradient
                colors={["#4FC6D3", "#7B66F5"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.banner}
              >
                <View style={styles.bannerContent}>
                  <View style={styles.bannerTextContainer}>
                    <Text style={styles.bannerTitle}>Child List</Text>
                    <Text style={styles.bannerSubtitle}>
                      Manage recorded children
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.addChildButton}
                    onPress={() => router.push("/(children)/add-child" as any)}
                  >
                    <Ionicons name="add" size={20} color="#9333EA" />
                    <Text style={styles.addChildButtonText}>Add Child</Text>
                  </TouchableOpacity>
                </View>
              </LinearGradient>

              {/* Search and Filter Bar */}
              <View style={styles.searchFilterBar}>
                <View style={styles.searchContainer}>
                  <Ionicons
                    name="search"
                    size={20}
                    color="#6B7280"
                    style={styles.searchIcon}
                  />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search child..."
                    placeholderTextColor="#9CA3AF"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                </View>
                <View style={styles.filterContainer}>
                  <View style={styles.viewingLabel}>
                    <Text style={styles.viewingText}>Viewing:</Text>
                    <View style={styles.viewingBadge}>
                      <Text style={styles.viewingBadgeText}>{currentView}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.filterButton}
                    onPress={() => setIsStatusDropdownOpen(true)}
                  >
                    <Text style={styles.filterButtonText}>{statusFilterLabel}</Text>
                    <Ionicons name="chevron-down" size={16} color="#9333EA" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Simple list header */}
              <View style={styles.listCard}>
                <View style={styles.listHeader}>
                  <Text style={styles.listHeaderText}>CHILD NAME</Text>
                </View>
                {/* Child rows */}
                {isLoadingChildren ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#4F46E5" />
                    <Text style={styles.loadingText}>Loading children...</Text>
                  </View>
                ) : children.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No children found</Text>
                  </View>
                ) : (
                  children.map((child, index) => {
                    const isSelected = selectedChildren.has(child.id);
                    const isLast = index === children.length - 1;
                    return (
                      <Pressable
                        key={child.id}
                        style={[
                          styles.listRow,
                          isSelected && styles.listRowSelected,
                          isLast && styles.listRowLast,
                        ]}
                        onLongPress={() => handleLongPress(child.id)}
                        onPress={() => handleCardPress(child.id)}
                      >
                        <Text style={styles.listRowText}>{child.name}</Text>
                        <Ionicons
                          name="chevron-forward"
                          size={18}
                          color="#9CA3AF"
                        />
                      </Pressable>
                    );
                  })
                )}
              </View>
            </ScrollView>

            {/* Status Filter Dropdown Modal */}
            <Modal
              visible={isStatusDropdownOpen}
              transparent
              animationType="fade"
              onRequestClose={() => setIsStatusDropdownOpen(false)}
            >
              <TouchableOpacity
                style={styles.itemsPerPageOverlay}
                activeOpacity={1}
                onPress={() => setIsStatusDropdownOpen(false)}
              >
                <View style={styles.statusDropdownContainer}>
                  {statusOptions.map(option => {
                    if (option.type === 'header') {
                      return (
                        <Text key={option.label} style={styles.statusHeaderText}>
                          {option.label}
                        </Text>
                      );
                    }
                    const isSelected =
                      option.label === 'All Status'
                        ? !wfaId && !wfhId && !hfaId
                        : (() => {
                            const statusIds = statusIdMap[option.label];
                            if (!statusIds) return false;
                            return (
                              (statusIds.wfaId !== undefined && statusIds.wfaId === wfaId) ||
                              (statusIds.wfhId !== undefined && statusIds.wfhId === wfhId) ||
                              (statusIds.hfaId !== undefined && statusIds.hfaId === hfaId)
                            );
                          })();
                    return (
                      <TouchableOpacity
                        key={option.label}
                        style={[
                          styles.statusOption,
                          isSelected && styles.statusOptionSelected,
                        ]}
                        onPress={() => handleStatusSelect(option)}
                      >
                        <Text
                          style={[
                            styles.statusOptionText,
                            isSelected && styles.statusOptionTextSelected,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </TouchableOpacity>
            </Modal>

            {/* Pagination pinned to bottom - outside ScrollView */}
            {totalItems > 0 && totalPages > 0 && (
              <View style={[styles.pagination, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                  <View style={styles.paginationLeft}>
                    <Text style={styles.paginationText}>Show</Text>
                    <View
                      style={styles.itemsPerPageContainer}
                      ref={itemsPerPageButtonRef}
                    >
                      <TouchableOpacity
                        style={styles.itemsPerPageSelect}
                        onPress={() => {
                          itemsPerPageButtonRef.current?.measure(
                            (x, y, width, height, pageX, pageY) => {
                              setDropdownPosition({ x: pageX, y: pageY - 160 }); // Position above the button
                              setIsItemsPerPageDropdownOpen(true);
                            }
                          );
                        }}
                      >
                        <Text style={styles.itemsPerPageText}>
                          {itemsPerPage}
                        </Text>
                        <Ionicons
                          name="chevron-down"
                          size={16}
                          color="#6B7280"
                        />
                      </TouchableOpacity>
                      <Modal
                        visible={isItemsPerPageDropdownOpen}
                        transparent={true}
                        animationType="fade"
                        onRequestClose={() =>
                          setIsItemsPerPageDropdownOpen(false)
                        }
                      >
                        <TouchableOpacity
                          style={styles.itemsPerPageOverlay}
                          activeOpacity={1}
                          onPress={() => setIsItemsPerPageDropdownOpen(false)}
                        >
                          <View
                            style={[
                              styles.itemsPerPageModalContainer,
                              {
                                top: dropdownPosition.y,
                                left: dropdownPosition.x,
                              },
                            ]}
                          >
                            <View style={styles.itemsPerPageDropdown}>
                              {[5, 10, 50, 100].map((value) => (
                                <TouchableOpacity
                                  key={value}
                                  style={[
                                    styles.itemsPerPageOption,
                                    itemsPerPage === value &&
                                      styles.itemsPerPageOptionActive,
                                  ]}
                                  onPress={() => {
                                    setItemsPerPage(value);
                                    setIsItemsPerPageDropdownOpen(false);
                                  }}
                                >
                                  <Text
                                    style={[
                                      styles.itemsPerPageOptionText,
                                      itemsPerPage === value &&
                                        styles.itemsPerPageOptionTextActive,
                                    ]}
                                  >
                                    {value}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>
                        </TouchableOpacity>
                      </Modal>
                    </View>
                    <Text style={styles.paginationText}>
                      Showing {startItem} to {endItem} of {totalItems} entries
                    </Text>
                  </View>
                  <View style={styles.paginationRight}>
                    <TouchableOpacity
                      style={[
                        styles.paginationButton,
                        currentPage === 1 && styles.paginationButtonDisabled,
                      ]}
                      onPress={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                    >
                      <Text style={styles.paginationButtonText}>{"<<"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.paginationButton,
                        currentPage === 1 && styles.paginationButtonDisabled,
                      ]}
                      onPress={() =>
                        setCurrentPage(Math.max(1, currentPage - 1))
                      }
                      disabled={currentPage === 1}
                    >
                      <Text style={styles.paginationButtonText}>Prev</Text>
                    </TouchableOpacity>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <TouchableOpacity
                          key={pageNum}
                          style={[
                            styles.paginationButton,
                            currentPage === pageNum &&
                              styles.paginationButtonActive,
                          ]}
                          onPress={() => setCurrentPage(pageNum)}
                        >
                          <Text
                            style={[
                              styles.paginationButtonText,
                              currentPage === pageNum &&
                                styles.paginationButtonTextActive,
                            ]}
                          >
                            {pageNum}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                    <TouchableOpacity
                      style={[
                        styles.paginationButton,
                        currentPage === totalPages &&
                          styles.paginationButtonDisabled,
                      ]}
                      onPress={() =>
                        setCurrentPage(Math.min(totalPages, currentPage + 1))
                      }
                      disabled={currentPage === totalPages}
                    >
                      <Text style={styles.paginationButtonText}>Next</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.paginationButton,
                        currentPage === totalPages &&
                          styles.paginationButtonDisabled,
                      ]}
                      onPress={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                    >
                      <Text style={styles.paginationButtonText}>{">>"}</Text>
                    </TouchableOpacity>
                    <View style={styles.goToContainer}>
                      <Text style={styles.goToText}>Go to</Text>
                      <View style={styles.goToInput}>
                        <TextInput
                          style={styles.goToInputText}
                          value={goToValue}
                          keyboardType="numeric"
                          onChangeText={text => {
                            const sanitized = text.replace(/[^0-9]/g, '');
                            setGoToValue(sanitized);
                          }}
                          onSubmitEditing={() => {
                            const page = parseInt(goToValue, 10);
                            if (!Number.isNaN(page)) {
                              const clamped = Math.min(
                                Math.max(page, 1),
                                Math.max(totalPages, 1),
                              );
                              setCurrentPage(clamped);
                              setGoToValue(clamped.toString());
                            } else {
                              setGoToValue(currentPage.toString());
                            }
                          }}
                          onBlur={() => {
                            const page = parseInt(goToValue, 10);
                            if (!Number.isNaN(page)) {
                              const clamped = Math.min(
                                Math.max(page, 1),
                                Math.max(totalPages, 1),
                              );
                              setCurrentPage(clamped);
                              setGoToValue(clamped.toString());
                            } else {
                              setGoToValue(currentPage.toString());
                            }
                          }}
                        />
                      </View>
                    </View>
                  </View>
                </View>
              )}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  layout: {
    flex: 1,
    flexDirection: "column",
  },
  content: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  topHeader: {
    backgroundColor: "#FFFFFF",
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    boxShadow: "0px 2px 8px 0px rgba(0, 0, 0, 0.05)",
  },
  topHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  topHeaderBrand: {
    flexDirection: "row",
    alignItems: "center",
  },
  topHeaderBrandTextPrimary: {
    fontSize: 18,
    fontWeight: "700",
    color: "#14B8A6",
  },
  topHeaderBrandTextAccent: {
    fontSize: 18,
    fontWeight: "700",
    color: "#4C1D95",
    marginLeft: 2,
  },
  topHeaderLocationPill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#FFFFFF",
    gap: 6,
  },
  topHeaderLocationText: {
    fontSize: 13,
    color: "#374151",
  },
  topHeaderProfileWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  topHeaderProfileCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  topHeaderProfileChevron: {
    marginTop: 2,
  },
  topHeaderProfileContainer: {
    position: 'relative',
    zIndex: 1000,
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 60,
    paddingRight: 16,
  },
  profileDropdownContainer: {
    alignItems: 'flex-end',
  },
  profileDropdown: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    paddingVertical: 8,
  },
  dropdownHeader: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingVertical: 8,
    letterSpacing: 0.5,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#374151',
  },
  banner: {
    borderRadius: 12,
    marginBottom: 24,
    padding: 20,
    minHeight: 120,
  },
  bannerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flex: 1,
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  bannerSubtitle: {
    fontSize: 14,
    color: "#FFFFFF",
    opacity: 0.9,
  },
  addChildButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  addChildButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9333EA",
  },
  searchFilterBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    gap: 12,
    flexWrap: "wrap",
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingHorizontal: 12,
    minWidth: 200,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#1F2937",
    paddingVertical: 10,
  },
  filterContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    width: "100%",
  },
  viewingLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  viewingText: {
    fontSize: 14,
    color: "#6B7280",
  },
  viewingBadge: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  viewingBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#9333EA",
  },
  listCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    marginBottom: 30,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  listHeader: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  listHeaderText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9CA3AF",
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  listRowSelected: {
    backgroundColor: "#EEF2FF",
  },
  listRowLast: {
    borderBottomWidth: 0,
  },
  listRowText: {
    fontSize: 14,
    color: "#111827",
  },
  scrollArea: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  loadingText: {
    fontSize: 14,
    color: "#6B7280",
    marginLeft: 8,
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#6B7280",
  },
  pagination: {
    flexDirection: "column",
    justifyContent: "center",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    gap: 12,
  },
  paginationLeft: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    flexShrink: 1,
  },
  paginationText: {
    fontSize: 14,
    color: "#6B7280",
  },
  itemsPerPageContainer: {
    position: 'relative',
    zIndex: 1000,
  },
  itemsPerPageOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  itemsPerPageModalContainer: {
    position: 'absolute',
  },
  itemsPerPageSelect: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  itemsPerPageDropdown: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 6,
    minWidth: 60,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 10,
  },
  itemsPerPageOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  itemsPerPageOptionActive: {
    backgroundColor: '#EEF2FF',
  },
  itemsPerPageText: {
    fontSize: 14,
    color: "#1F2937",
  },
  itemsPerPageOptionText: {
    fontSize: 14,
    color: '#374151',
  },
  itemsPerPageOptionTextActive: {
    color: '#9333EA',
    fontWeight: '600',
  },
  paginationRight: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  paginationButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    minWidth: 36,
    alignItems: "center",
  },
  paginationButtonActive: {
    backgroundColor: "#9333EA",
    borderColor: "#9333EA",
  },
  paginationButtonDisabled: {
    opacity: 0.5,
  },
  paginationButtonText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  paginationButtonTextActive: {
    color: "#FFFFFF",
  },
  goToContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: 8,
  },
  goToText: {
    fontSize: 14,
    color: "#6B7280",
  },
  goToInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 50,
  },
  goToInputText: {
    fontSize: 14,
    color: "#1F2937",
    textAlign: "center",
  },
  contentBody: {
    flex: 1,
    flexDirection: 'column',
  },
  statusDropdownContainer: {
    marginTop: 80,
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
  },
  statusHeaderText: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
  },
  statusOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  statusOptionSelected: {
    backgroundColor: '#2563EB',
  },
  statusOptionText: {
    fontSize: 14,
    color: '#111827',
  },
  statusOptionTextSelected: {
    color: '#FFFFFF',
  },
});

