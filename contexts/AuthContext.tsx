import { login as apiLogin, logout as apiLogout, LoginCredentials } from '@/lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';

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

interface User {
  user_id: string;
  username: string;
  email: string;
  role_id: number;
  user_status_id: number;
  user_created_at: string;
  user_updated_at: string;
  profile?: UserProfile;
  role?: UserRole;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  handleTokenInvalidation: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = '@nutritrack_token';
const USER_KEY = '@nutritrack_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem(TOKEN_KEY);
      const storedUser = await AsyncStorage.getItem(USER_KEY);

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error('Error loading stored auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (credentials: LoginCredentials) => {
    try {
      const response = await apiLogin(credentials);
      
      if (response.token && response.user) {
        await AsyncStorage.setItem(TOKEN_KEY, response.token);
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(response.user));
        setToken(response.token);
        setUser(response.user);
        router.replace('/(children)/child-list' as any);
      } else {
        throw new Error(response.message || 'Login failed');
      }
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      if (token) {
        await apiLogout(token);
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await AsyncStorage.removeItem(TOKEN_KEY);
      await AsyncStorage.removeItem(USER_KEY);
      setToken(null);
      setUser(null);
      router.replace('/login' as any);
    }
  };

  const handleTokenInvalidation = () => {
    Alert.alert(
      'Session Expired',
      "Sorry, you've logged in to another device and you will be logging out. Please Login again.",
      [
        {
          text: 'Okay',
          onPress: async () => {
            await logout();
          },
        },
      ],
      { cancelable: false }
    );
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!token && !!user,
        login,
        logout,
        handleTokenInvalidation,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

