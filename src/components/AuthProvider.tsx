import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/src/firebase';
import { UserProfile, Role } from '@/src/types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAuthReady: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAuthReady: false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        // Use onSnapshot for real-time profile updates and faster initial load
        unsubscribeProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), async (snapshot) => {
          if (snapshot.exists()) {
            const currentProfile = snapshot.data() as UserProfile;
            
            // Set profile immediately to avoid flickering
            setProfile(currentProfile);
            
            // CEO Bootstrap logic
            const isCEOEmail = firebaseUser.email?.toLowerCase() === 'tjrwnfjqm1@gmail.com';
            
            // If it's the specific CEO email, ensure they have the CEO role
            if (isCEOEmail && currentProfile.role !== 'CEO') {
              console.log("Force setting CEO role for", isCEOEmail);
              await updateDoc(doc(db, 'users', firebaseUser.uid), { role: 'CEO' as Role });
            }
          } else {
            // New user registration
            const email = firebaseUser.email || '';
            const employeeId = email.split('@')[0] || '';
            const isBootstrapCEO = 
              employeeId.toLowerCase() === 'x66626' || 
              email.toLowerCase() === 'tjrwnfjqm1@gmail.com';
            
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              employeeId: employeeId,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || employeeId.toUpperCase() || 'Anonymous',
              role: isBootstrapCEO ? 'CEO' : 'EMPLOYEE',
              isActive: true,
              joinedAt: new Date().toISOString(),
            };
            await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
            setProfile(newProfile);
          }
          setLoading(false);
          setIsAuthReady(true);
        }, (error) => {
          console.error("Profile snapshot error:", error);
          setLoading(false);
          setIsAuthReady(true);
        });
      } else {
        if (unsubscribeProfile) unsubscribeProfile();
        setProfile(null);
        setLoading(false);
        setIsAuthReady(true);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAuthReady }}>
      {children}
    </AuthContext.Provider>
  );
};
