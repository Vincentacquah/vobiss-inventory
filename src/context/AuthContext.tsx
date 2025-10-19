// Updated AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      try {
        // Decode JWT payload (client-side, not verified)
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser({ 
          username: payload.username, 
          role: payload.role,
          first_name: payload.first_name,
          last_name: payload.last_name,
          full_name: payload.full_name
        });
      } catch (error) {
        console.error('Invalid token');
        setToken(null);
        localStorage.removeItem('token');
      }
    } else {
      setUser(null);
    }
  }, [token]);

  const login = (newToken: string, userData: User) => {
    setToken(newToken);
    localStorage.setItem('token', newToken);
    setUser(userData);
  };

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
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};