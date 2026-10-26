import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  const checkAuth = useCallback(async () => {
    try {
      const data = await authApi.getMe();
      if (data && data.user) {
        setUser(data.user);
        setIsGuest(false);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const signin = async (email, password, rememberMe = false) => {
    const data = await authApi.signin({ email, password, rememberMe });
    setUser(data.user);
    setIsGuest(false);
    return data.user;
  };

  const signup = async ({ name, email, password, confirmPassword, acceptTerms = true }) => {
    const data = await authApi.signup({
      name,
      email,
      password,
      confirmPassword,
      acceptTerms,
    });
    setUser(data.user);
    setIsGuest(false);
    return data.user;
  };

  const requestEmailOtp = async ({ email, name }) => {
    return authApi.requestEmailOtp({ email, name });
  };

  const verifyEmailOtp = async ({ email, code, name }) => {
    const data = await authApi.verifyEmailOtp({ email, code, name });
    setUser(data.user);
    setIsGuest(false);
    return data.user;
  };

  const requestPhoneOtp = async ({ countryCode, phoneNumber, name }) => {
    return authApi.requestPhoneOtp({ countryCode, phoneNumber, name });
  };

  const verifyPhoneOtp = async ({ countryCode, phoneNumber, phone, code, name }) => {
    const data = await authApi.verifyPhoneOtp({
      countryCode,
      phoneNumber,
      phone,
      code,
      name,
    });
    setUser(data.user);
    setIsGuest(false);
    return data.user;
  };

  const forgotPassword = async (email) => {
    return authApi.forgotPassword({ email });
  };

  const resetPassword = async ({ email, code, newPassword, confirmPassword }) => {
    return authApi.resetPassword({ email, code, newPassword, confirmPassword });
  };

  const signout = async () => {
    try {
      await authApi.signout();
    } finally {
      setUser(null);
      setIsGuest(false);
    }
  };

  const updateUser = async (updates) => {
    const data = await authApi.updateProfile(updates);
    if (data && data.user) {
      setUser(data.user);
    }
    return data.user;
  };

  const enterGuestMode = () => {
    setIsGuest(true);
    setUser(null);
  };

  const value = {
    user,
    loading,
    isGuest,
    isAuthenticated: Boolean(user),
    signin,
    signup,
    requestEmailOtp,
    verifyEmailOtp,
    requestPhoneOtp,
    verifyPhoneOtp,
    forgotPassword,
    resetPassword,
    signout,
    updateUser,
    enterGuestMode,
    refreshUser: checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
