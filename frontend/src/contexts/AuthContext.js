import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { updateApiAuth } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);

  // Check if user is already logged in on app start
  useEffect(() => {
    const checkAuthStatus = () => {
      const username = localStorage.getItem('username');
      const password = localStorage.getItem('password');
      
      if (username && password) {
        // Test the credentials by making a simple API call
        testCredentials(username, password);
      } else {
        setIsLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  const testCredentials = async (username, password) => {
    try {
      const response = await axios.get(`${API_URL}/episodes`, {
        auth: { username, password },
        timeout: 5000
      });
      
      if (response.status === 200) {
        setIsAuthenticated(true);
        setUser({ username });
      }
    } catch (error) {
      // Credentials are invalid, clear them
      localStorage.removeItem('username');
      localStorage.removeItem('password');
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      // Test credentials by making an API call
      const response = await axios.get(`${API_URL}/episodes`, {
        auth: { username, password },
        timeout: 5000
      });

      if (response.status === 200) {
        // Store credentials
        localStorage.setItem('username', username);
        localStorage.setItem('password', password);
        
        setIsAuthenticated(true);
        setUser({ username });
        
        // Update the API service auth
        updateApiAuth(username, password);
        
        return true;
      }
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('Invalid username or password');
      } else {
        throw new Error('Login failed. Please check your connection.');
      }
    }
  };

  const logout = () => {
    localStorage.removeItem('username');
    localStorage.removeItem('password');
    setIsAuthenticated(false);
    setUser(null);
    
    // Reset API auth to defaults
    updateApiAuth('admin', 'password');
  };


  const value = {
    isAuthenticated,
    isLoading,
    user,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
