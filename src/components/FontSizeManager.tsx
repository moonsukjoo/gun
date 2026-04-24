
import React, { useEffect } from 'react';
import { useAuth } from './AuthProvider';

export const FontSizeManager: React.FC = () => {
  const { profile } = useAuth();
  
  useEffect(() => {
    if (profile?.elderlyMode) {
      document.documentElement.classList.add('elderly-mode');
    } else {
      document.documentElement.classList.remove('elderly-mode');
    }
  }, [profile?.elderlyMode]);

  return null; // This component doesn't render anything
};
