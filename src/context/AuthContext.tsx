// AuthContext.tsx (FINAL: Warning modal stays until button clicked)
import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
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

// Timeout settings
const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes
const WARNING_TIME = 5 * 60 * 1000;        // Show warning 5 min before

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const navigate = useNavigate();

  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Load persisted data on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (savedToken) {
      setToken(savedToken);
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser));
        } catch {
          console.error('Invalid saved user data');
          localStorage.removeItem('user');
        }
      }
    }
  }, []);

  // Decode JWT if user not already loaded
  useEffect(() => {
    if (token && !user) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const derivedUser: User = {
          username: payload.username,
          role: payload.role,
          first_name: payload.first_name,
          last_name: payload.last_name,
          full_name: payload.full_name,
        };
        setUser(derivedUser);
        localStorage.setItem('user', JSON.stringify(derivedUser));
      } catch {
        console.error('Invalid token');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
      }
    }
  }, [token, user]);

  // Persist user
  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  }, [user]);

  const clearTimers = () => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    inactivityTimerRef.current = null;
    warningTimerRef.current = null;
  };

  const resetInactivityTimer = () => {
    clearTimers();
    lastActivityRef.current = Date.now();

    // Show warning 5 minutes before expiry
    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
    }, INACTIVITY_TIMEOUT - WARNING_TIME);

    // Auto logout after full timeout
    inactivityTimerRef.current = setTimeout(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= INACTIVITY_TIMEOUT) {
        console.log('Session expired due to inactivity.');
        alert('Your session has expired. Please log in again.');
        logout();
      }
    }, INACTIVITY_TIMEOUT);
  };

  const stayActive = () => {
    setShowWarning(false);
    lastActivityRef.current = Date.now();
    resetInactivityTimer();
  };

  const login = (newToken: string, userData: User) => {
    setToken(newToken);
    localStorage.setItem('token', newToken);
    setUser(userData);
    resetInactivityTimer();
  };

  const logout = async () => {
    setShowWarning(false);
    const currentToken = localStorage.getItem('token');

    try {
      if (currentToken) {
        await fetch('/api/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${currentToken}`,
            'Content-Type': 'application/json',
          },
        });
      }
    } catch (error) {
      console.error('Logout API error:', error);
    }

    clearTimers();
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  // Activity tracking — IGNORE when warning is shown
  useEffect(() => {
    if (!user) return;

    const handleActivity = () => {
      // CRITICAL: Ignore all activity when modal is open
      if (showWarning) return;

      lastActivityRef.current = Date.now();
      resetInactivityTimer();
    };

    const events = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'];
    events.forEach(event => window.addEventListener(event, handleActivity, true));

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        const elapsed = now - lastActivityRef.current;

        if (elapsed >= INACTIVITY_TIMEOUT) {
          logout();
        } else if (elapsed >= INACTIVITY_TIMEOUT - WARNING_TIME && !showWarning) {
          setShowWarning(true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    // Start timer on login
    resetInactivityTimer();

    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity, true));
      document.removeEventListener('visibilitychange', handleVisibility);
      clearTimers();
    };
  }, [user, showWarning]); // ← showWarning in deps to rebind handler

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}

      {/* Session Warning Modal */}
      {showWarning && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            // Prevent interaction with background
            pointerEvents: 'none',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #000000',
              borderRadius: '0',
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
              maxWidth: '400px',
              width: '90%',
              fontFamily: 'Arial, sans-serif',
              overflow: 'hidden',
              pointerEvents: 'auto', // Re-enable for modal
            }}
          >
            {/* Title Bar */}
            <div
              style={{
                backgroundColor: '#000080',
                color: '#ffffff',
                padding: '8px 12px',
                fontWeight: 'bold',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>Session Expiring</span>
              <button
                onClick={stayActive}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '16px',
                  cursor: 'pointer',
                  padding: 0,
                  width: '20px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div
              style={{
                padding: '20px',
                textAlign: 'center',
                backgroundColor: '#f0f0f0',
                color: '#000000',
              }}
            >
              <p style={{ marginBottom: '15px', fontSize: '14px', lineHeight: '1.5' }}>
                Your session will expire in 5 minutes due to inactivity.
                <br />
                Would you like to stay active?
              </p>
              <div>
                <button
                  onClick={stayActive}
                  style={{
                    backgroundColor: '#c0c0c0',
                    border: '1px outset #ffffff',
                    color: '#000000',
                    padding: '6px 16px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    marginRight: '10px',
                    minWidth: '100px',
                  }}
                >
                  Yes, Stay Active
                </button>
                <button
                  onClick={logout}
                  style={{
                    backgroundColor: '#c0c0c0',
                    border: '1px outset #ffffff',
                    color: '#000000',
                    padding: '6px 16px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    minWidth: '100px',
                  }}
                >
                  Log Out Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
};