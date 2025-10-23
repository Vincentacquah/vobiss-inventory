// Updated AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom'; // NEW: For auto-redirect on logout

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

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null); // Will load from localStorage below
  const navigate = useNavigate(); // NEW: For redirect

  // NEW: Load persisted state on mount (token + user as fallback)
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user'); // NEW: Load full user if available

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

  // UPDATED: Derive user from token only if no saved user (fallback)
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
        // NEW: Save derived user for future loads
        localStorage.setItem('user', JSON.stringify(derivedUser));
      } catch (error) {
        console.error('Invalid token');
        setToken(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user'); // NEW: Clear invalid user too
        setUser(null);
      }
    }
  }, [token, user]); // Depend on user to avoid loops

  // UPDATED: Persist user on login/change
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
    // NEW: Optional - navigate to dashboard after login (adjust path)
    // navigate('/dashboard', { replace: true });
  };

  // UPDATED: Logout with API call + redirect
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
    localStorage.removeItem('user'); // NEW: Clear user too
    setUser(null);
    // NEW: Redirect to login
    navigate('/login', { replace: true });
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};