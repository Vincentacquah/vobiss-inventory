// Updated AuthContext.tsx with inactivity logout
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface User {
  username: string;
  role: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes in milliseconds

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const navigate = useNavigate();

  // Load persisted state on mount (token + user as fallback)
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (savedToken) {
      setToken(savedToken);
      if (savedUser) {
        // Prefer saved user (avoids decode errors)
        try {
          setUser(JSON.parse(savedUser));
        } catch (error) {
          console.error('Invalid saved user data');
          localStorage.removeItem('user');
        }
      }
    } else {
      setToken(null);
      setUser(null);
    }
  }, []);

  // Derive user from token only if no saved user (fallback)
  useEffect(() => {
    if (token && !user) { // Only if user not already loaded
      try {
        // Decode JWT payload (client-side, not verified)
        const payload = JSON.parse(atob(token.split('.')[1]));
        const derivedUser: User = { 
          username: payload.username, 
          role: payload.role,
          first_name: payload.first_name,
          last_name: payload.last_name,
          full_name: payload.full_name
        };
        setUser(derivedUser);
        // Save derived user for future loads
        localStorage.setItem('user', JSON.stringify(derivedUser));
      } catch (error) {
        console.error('Invalid token');
        setToken(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
      }
    }
  }, [token, user]); // Depend on user to avoid loops

  // Persist user on login/change
  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  }, [user]);

  const login = (newToken: string, userData: User) => {
    setToken(newToken);
    localStorage.setItem('token', newToken);
    setUser(userData);
    resetInactivityTimer();
  };

  // Logout with API call + redirect
  const logout = async () => {
    const currentToken = localStorage.getItem('token');
    try {
      if (currentToken) {
        // Call logout API if needed
        await fetch('/api/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${currentToken}`,
            'Content-Type': 'application/json',
          },
        });
      }
    } catch (error) {
      console.error('Logout API error:', error);
    }
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    // Redirect to login
    navigate('/login', { replace: true });
    clearInactivityTimer();
  };

  // Inactivity timer logic
  let inactivityTimer: NodeJS.Timeout;

  const resetInactivityTimer = () => {
    clearInactivityTimer();
    inactivityTimer = setTimeout(() => {
      console.log('Inactivity detected. Logging out...');
      logout();
      alert('You have been logged out due to inactivity. Please log in again.');
    }, INACTIVITY_TIMEOUT);
  };

  const clearInactivityTimer = () => {
    if (inactivityTimer) {
      clearTimeout(inactivityTimer);
    }
  };

  // Reset timer on user activity (mousemove, keydown, scroll, etc.)
  useEffect(() => {
    if (!user) return;

    const handleActivity = () => {
      resetInactivityTimer();
    };

    const events = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'];
    events.forEach(event => window.addEventListener(event, handleActivity, true));

    // Initial timer setup
    resetInactivityTimer();

    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity, true));
      clearInactivityTimer();
    };
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};