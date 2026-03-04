import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import AuthPage from './components/AuthPage';
import HomePage from './components/HomePage';
import OrdersPage from './components/OrdersPage';
import WalletPage from './components/WalletPage';
import NotificationsPage from './components/NotificationsPage';
import ProfilePage from './components/ProfilePage';
import BottomNav from './components/BottomNav';
import AdminPanel from './components/AdminPanel';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Coins, ShieldAlert } from 'lucide-react';
import { formatCurrency } from './utils';
import { db, auth } from './firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect } from 'react';

const AppContent = () => {
  const { user, userData, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('home');
  const [isAdminView, setIsAdminView] = useState(false);
  const [appName, setAppName] = useState('InstaBoost');

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'app_config'), (doc) => {
      if (doc.exists()) {
        setAppName(doc.data().appName || 'InstaBoost');
      }
    });
    return () => unsub();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-12 h-12 animate-spin text-white" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  if (userData?.isBlocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center space-y-6">
        <div className="w-24 h-24 bg-rose-500/10 rounded-full flex items-center justify-center">
          <ShieldAlert className="w-12 h-12 text-rose-500" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-black text-white">Account Blocked</h1>
          <p className="text-white/60 font-medium">Your account has been suspended by the administrator. You cannot access the app services at this time.</p>
        </div>
        <button 
          onClick={() => auth.signOut()}
          className="bg-white text-rose-500 px-8 py-3 rounded-2xl font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-transform"
        >
          Sign Out
        </button>
      </div>
    );
  }

  if (isAdminView) {
    return <AdminPanel onBack={() => setIsAdminView(false)} />;
  }

  const renderPage = () => {
    switch (activeTab) {
      case 'home': return <HomePage onOrderSuccess={() => setActiveTab('orders')} />;
      case 'orders': return <OrdersPage />;
      case 'wallet': return <WalletPage />;
      case 'notifications': return <NotificationsPage />;
      case 'profile': return <ProfilePage onAdminAccess={() => setIsAdminView(true)} />;
      default: return <HomePage />;
    }
  };

  return (
    <div className="pb-24 pt-20 px-4 max-w-md mx-auto min-h-screen relative overflow-x-hidden">
      {/* Top Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-lg border-b border-slate-100 z-50 px-6 flex items-center justify-between">
        <h1 className="text-2xl font-black tracking-tighter text-cyan-500">{appName}</h1>
        <div className="flex items-center gap-2 bg-cyan-50 px-3 py-1.5 rounded-full border border-cyan-100">
          <Coins className="w-4 h-4 text-cyan-500" />
          <span className="text-sm font-bold text-cyan-600">{formatCurrency(userData?.walletBalance || 0)}</span>
        </div>
      </header>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          {renderPage()}
        </motion.div>
      </AnimatePresence>
      
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </AuthProvider>
  );
}
