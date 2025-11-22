import { redirect } from 'next/navigation';
import { getUserIdFromSession } from '@/lib/auth';
import dbConnect from '@/lib/db/mongoose';
import User from '@/lib/db/models/User';
import ROLShell from '@/components/ROLShell';

export default async function ShellPage() {
  // Server-side authentication check
  const userId = await getUserIdFromSession();
  
  if (!userId) {
    console.log('[SHELL] No session found, redirecting to login');
    redirect('/');
  }

  // Verify user exists in database
  try {
    await dbConnect();
    const user = await User.findById(userId);
    
    if (!user) {
      console.log('[SHELL] User not found in database, redirecting to login');
      redirect('/');
    }
    
    console.log('[SHELL] User authenticated:', user.username);
  } catch (error) {
    console.error('[SHELL] Error verifying user:', error);
    redirect('/');
  }

  return <ROLShell />;
}
