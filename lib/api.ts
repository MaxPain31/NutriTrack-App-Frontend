// Configure your Laravel API URL here or set EXPO_PUBLIC_API_URL environment variable
// Example: EXPO_PUBLIC_API_URL=http://your-laravel-api.com
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://72.60.236.137:8002';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface Province {
  province_id: number;
  province_name: string;
  province_created_at: string;
  province_updated_at: string | null;
}

export interface Municipality {
  municipality_id: number;
  province_id: number;
  municipality_name: string;
  municipality_created_at: string;
  municipality_updated_at: string | null;
  province?: Province;
}

export interface Barangay {
  barangay_id: number;
  municipality_id: number;
  barangay_name: string;
  barangay_created_at: string;
  barangay_updated_at: string | null;
}

export interface UserProfile {
  user_id: string;
  user_first_name: string;
  user_last_name: string;
  user_middle_name: string;
  user_birthdate: string;
  barangay_id: number;
  municipality_id: number;
  image_path: string | null;
  user_profile_created_at: string;
  user_profile_updated_at: string;
  name_extension_id: number | null;
  municipality?: Municipality;
  barangay?: Barangay;
}

export interface UserRole {
  role_id: number;
  role_name: string;
  role_created_at: string;
  role_updated_at: string | null;
}

export interface LoginResponse {
  user?: {
    user_id: string;
    username: string;
    email: string;
    role_id: number;
    user_status_id: number;
    user_created_at: string;
    user_updated_at: string;
    profile?: UserProfile;
    role?: UserRole;
  };
  token?: string;
  token_type?: string;
  message?: string;
  errors?: {
    [key: string]: string[];
  };
}

export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    let data: LoginResponse;
    try {
      data = await response.json() as LoginResponse;
    } catch (jsonError) {
      // If response is not JSON, get text instead
      const text = await response.text();
      throw new Error(text || `HTTP ${response.status}: ${response.statusText}`);
    }

    if (!response.ok) {
      // Extract error message from Laravel validation response
      let errorMessage = data.message || 'Login failed';
      
      // If there are validation errors, try to get the first error message
      if (data.errors) {
        const errorKeys = Object.keys(data.errors);
        if (errorKeys.length > 0) {
          const firstError = data.errors[errorKeys[0]];
          if (Array.isArray(firstError) && firstError.length > 0) {
            errorMessage = firstError[0];
          } else if (typeof firstError === 'string') {
            errorMessage = firstError;
          }
        }
      }
      
      console.log('API Error Response:', {
        status: response.status,
        statusText: response.statusText,
        data,
        extractedMessage: errorMessage
      });
      
      throw new Error(errorMessage);
    }

    return data;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Network error occurred');
  }
}

export async function logout(token: string): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/api/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
  } catch (error) {
    console.error('Logout error:', error);
  }
}

export async function getUser(token: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/user`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      // Check for token invalidation
      if (response.status === 401) {
        let errorData: { message?: string };
        try {
          errorData = await response.json() as { message?: string };
        } catch {
          errorData = { message: 'Unauthorized' };
        }
        
        // Check if error message indicates token was invalidated by another login
        const errorMessage = errorData.message || '';
        if (errorMessage.toLowerCase().includes('token') || 
            errorMessage.toLowerCase().includes('logged in') ||
            errorMessage.toLowerCase().includes('another device')) {
          throw new Error('TOKEN_INVALIDATED');
        }
      }
      throw new Error('Failed to fetch user');
    }

    return await response.json() as any;
  } catch (error) {
    if (error instanceof Error && error.message === 'TOKEN_INVALIDATED') {
      throw error;
    }
    console.error('Get user error:', error);
    throw error;
  }
}

export interface ChildSex {
  sex_id: number;
  sex: string;
  sex_created_at: string;
  sex_updated_at: string | null;
}

export interface ChildWFA {
  wfa_id: number;
  wfa_status: string;
  wfa_created_at: string;
  wfa_updated_at: string | null;
}

export interface ChildWFH {
  wfh_id: number;
  wfh_status: string;
  wfh_created_at: string;
  wfh_updated_at: string | null;
}

export interface ChildHFA {
  hfa_id: number;
  hfa_status: string;
  hfa_created_at: string;
  hfa_updated_at: string | null;
}

export interface HealthCondition {
  health_condition_id: number;
  condition_name: string;
  condition_description: string;
  user_id: string;
  created_at: string;
}

export interface Intervention {
  intervention_id: number;
  intervention_name: string;
  intervention_description: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface NameExtension {
  name_extension_id: number;
  name_extension: string;
}

export interface ChildCreator {
  user_id: string;
  username: string;
  email: string;
  role_id: number;
  user_status_id: number;
  user_created_at: string;
  user_updated_at: string;
}

export interface ChildData {
  child_id: string;
  child_first_name: string;
  child_middle_name: string;
  child_last_name: string;
  barangay_id: number;
  municipality_id: number;
  sex_id: number;
  child_birthdate: string;
  age: number;
  caregiver_id: string | null;
  image_path: string;
  image_url?: string | null;
  height: string;
  weight: string;
  wfa_id: number;
  wfh_id: number;
  hfa_id: number;
  is_archived: boolean;
  created_by: string;
  updated_by: string | null;
  child_created_at: string;
  child_updated_at: string | null;
  name_extension_id: number | null;
  barangay?: Barangay;
  municipality?: Municipality;
  caregiver: any | null;
  creator?: ChildCreator;
  updater: any | null;
  wfa?: ChildWFA;
  wfh?: ChildWFH;
  hfa?: ChildHFA;
  sex?: ChildSex;
  interventions?: {
    child_intervention_id: string;
    child_id: string;
    intervention_id: number;
    child_intervention_created_at: string;
    intervention: {
      intervention_id: number;
      intervention_name: string;
      intervention_description: string;
      user_id: string;
      created_at: string;
      updated_at: string;
    };
  }[];
  health_conditions?: {
    child_health_condition_id: string;
    child_id: string;
    health_condition_id: number;
    child_health_condition_created_at: string;
    health_condition: {
      health_condition_id: number;
      condition_name: string;
      condition_description: string;
      user_id: string;
      created_at: string;
    };
  }[];
}

export interface ChildrenResponse {
  children: ChildData[];
  pagination: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

const inFlightChildrenRequests = new Map<string, Promise<ChildrenResponse>>();

export async function getChildren(
  token: string,
  page: number = 1,
  perPage: number = 15,
  search?: string,
  barangayId?: number,
  isArchive?: number,
  wfaId?: number,
  wfhId?: number,
  hfaId?: number,
  sortBy?: 'name' | 'age',
  sortOrder?: 'asc' | 'desc'
): Promise<ChildrenResponse> {
  const key = [
    token,
    page,
    perPage,
    search || '',
    barangayId ?? '',
    isArchive ?? '',
    wfaId ?? '',
    wfhId ?? '',
    hfaId ?? '',
    sortBy || '',
    sortOrder || '',
  ].join('|');

  // If there's already a request in-flight with the same params, reuse it
  const existing = inFlightChildrenRequests.get(key);
  if (existing) {
    return existing;
  }

  const requestPromise = (async () => {
  try {
    const params = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString(),
    });
    
    if (search) {
      params.append('search', search);
    }

    if (typeof barangayId === 'number') {
      params.append('barangay_id', barangayId.toString());
    }

    if (typeof isArchive === 'number') {
      params.append('is_archive', isArchive.toString());
    }

    if (typeof wfaId === 'number') {
      params.append('wfa_id', wfaId.toString());
    }

    if (typeof wfhId === 'number') {
      params.append('wfh_id', wfhId.toString());
    }

    if (typeof hfaId === 'number') {
      params.append('hfa_id', hfaId.toString());
    }

    if (sortBy) {
      params.append('sort_by', sortBy);
    }

    if (sortOrder) {
      params.append('sort_order', sortOrder);
    }

    const response = await fetch(`${API_BASE_URL}/api/children?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      // Check for token invalidation
      if (response.status === 401) {
        let errorData: { message?: string };
        try {
          errorData = await response.json() as { message?: string };
        } catch {
          errorData = { message: 'Unauthorized' };
        }
        
        // Check if error message indicates token was invalidated by another login
        const errorMessage = errorData.message || '';
        if (errorMessage.toLowerCase().includes('token') || 
            errorMessage.toLowerCase().includes('logged in') ||
            errorMessage.toLowerCase().includes('another device')) {
          throw new Error('TOKEN_INVALIDATED');
        }
      }
      throw new Error('Failed to fetch children');
    }

    return await response.json() as ChildrenResponse;
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      throw error;
    }
    console.error('Get children error:', error);
    throw error;
  } finally {
    inFlightChildrenRequests.delete(key);
  }
  })();

  inFlightChildrenRequests.set(key, requestPromise);
  return requestPromise;
}

export async function getChildById(token: string, childId: string): Promise<ChildData> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/children/${childId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        let errorData: { message?: string };
        try {
          errorData = await response.json() as { message?: string };
        } catch {
          errorData = { message: 'Unauthorized' };
        }

        const errorMessage = errorData.message || '';
        if (
          errorMessage.toLowerCase().includes('token') ||
          errorMessage.toLowerCase().includes('logged in') ||
          errorMessage.toLowerCase().includes('another device')
        ) {
          throw new Error('TOKEN_INVALIDATED');
        }
      }
      throw new Error('Failed to fetch child');
    }

    const data = await response.json() as { child: ChildData };
    // API returns shape: { child: { ... } }
    return data.child as ChildData;
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      throw error;
    }
    console.error('Get child by id error:', error);
    throw error;
  }
}

export async function getHealthConditions(token: string): Promise<HealthCondition[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health-conditions`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        let errorData: { message?: string };
        try {
          errorData = await response.json() as { message?: string };
        } catch {
          errorData = { message: 'Unauthorized' };
        }

        const errorMessage = errorData.message || '';
        if (
          errorMessage.toLowerCase().includes('token') ||
          errorMessage.toLowerCase().includes('logged in') ||
          errorMessage.toLowerCase().includes('another device')
        ) {
          throw new Error('TOKEN_INVALIDATED');
        }
      }
      throw new Error('Failed to fetch health conditions');
    }

    const data = await response.json() as { health_conditions?: HealthCondition[] };
    return (data.health_conditions || []) as HealthCondition[];
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      throw error;
    }
    console.error('Get health conditions error:', error);
    throw error;
  }
}

export async function getInterventions(token: string): Promise<Intervention[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/interventions`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        let errorData: { message?: string };
        try {
          errorData = await response.json() as { message?: string };
        } catch {
          errorData = { message: 'Unauthorized' };
        }

        const errorMessage = errorData.message || '';
        if (
          errorMessage.toLowerCase().includes('token') ||
          errorMessage.toLowerCase().includes('logged in') ||
          errorMessage.toLowerCase().includes('another device')
        ) {
          throw new Error('TOKEN_INVALIDATED');
        }
      }
      throw new Error('Failed to fetch interventions');
    }

    const data = await response.json() as { interventions?: Intervention[] };
    return (data.interventions || []) as Intervention[];
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      throw error;
    }
    console.error('Get interventions error:', error);
    throw error;
  }
}

export async function getNameExtensions(token: string): Promise<NameExtension[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/name-extensions`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        let errorData: { message?: string };
        try {
          errorData = await response.json() as { message?: string };
        } catch {
          errorData = { message: 'Unauthorized' };
        }

        const errorMessage = errorData.message || '';
        if (
          errorMessage.toLowerCase().includes('token') ||
          errorMessage.toLowerCase().includes('logged in') ||
          errorMessage.toLowerCase().includes('another device')
        ) {
          throw new Error('TOKEN_INVALIDATED');
        }
      }
      throw new Error('Failed to fetch name extensions');
    }

    const data = await response.json() as { name_extensions?: NameExtension[]; data?: NameExtension[] };
    return (data.name_extensions || data.data || []) as NameExtension[];
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      throw error;
    }
    console.error('Get name extensions error:', error);
    throw error;
  }
}

