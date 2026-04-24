import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc, updateDoc, query, where, limit, getDocs, collection, deleteDoc } from 'firebase/firestore';
import { auth, db } from '@/src/firebase';
import { UserProfile, Role } from '@/src/types';
import { toast } from 'sonner';

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
        const email = firebaseUser.email || '';
        const employeeId = email.split('@')[0] || '';
        const usersRef = collection(db, 'users');

        // Check for manual profile recovery/migration every time at login
        // But only if we haven't synced in this session to prevent loops
        const syncPerformed = sessionStorage.getItem(`sync_${firebaseUser.uid}`);
        if (!syncPerformed) {
          // Search for existing profiles by employeeId (case-insensitive)
          const possibleIds = [employeeId, employeeId.toUpperCase(), employeeId.toLowerCase()];
          const qSync = query(usersRef, where('employeeId', 'in', [...new Set(possibleIds)]));
          const syncSnapshot = await getDocs(qSync);
          
          let manualProfileData: any = null;
          let manualDocId: string | null = null;
          
          syncSnapshot.docs.forEach(d => {
            if (d.id !== firebaseUser.uid) {
              const data = d.data();
              if (!manualProfileData || data.role !== 'EMPLOYEE') {
                manualProfileData = data;
                manualDocId = d.id;
              }
            }
          });

          if (manualDocId && manualProfileData) {
            console.log("Found manual profile to migrate:", manualDocId);
            const migratedProfile = {
              ...manualProfileData,
              uid: firebaseUser.uid,
              email: email
            };
            await setDoc(doc(db, 'users', firebaseUser.uid), migratedProfile);
            await deleteDoc(doc(db, 'users', manualDocId));
            sessionStorage.setItem(`sync_${firebaseUser.uid}`, 'true');
            toast.success('임직원 정보가 동기화되었습니다.');
          }
        }

        // Use onSnapshot for real-time profile updates
        unsubscribeProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), async (snapshot) => {
          if (snapshot.exists()) {
            const currentProfile = snapshot.data() as UserProfile;
            setProfile(currentProfile);
            
            // CEO Bootstrap logic
            const isCEOEmail = firebaseUser.email?.toLowerCase() === 'tjrwnfjqm1@gmail.com';
            if (isCEOEmail && currentProfile.role !== 'CEO') {
              await updateDoc(doc(db, 'users', firebaseUser.uid), { role: 'CEO' as Role });
            }
          } else {
            // Create a fresh profile if still nothing exists
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
          if (error.code === 'unavailable') {
            toast.error('데이터베이스 연결에 실패했습니다. 네트워크 상태를 확인하거나 잠시 후 다시 시도해주세요.', {
              id: 'firestore-unavailable'
            });
          }
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
