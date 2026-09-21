import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { app } from '@/lib/firebase';

export const auth = getAuth(app);

if (typeof window !== 'undefined') {
  void setPersistence(auth, browserLocalPersistence);
}
