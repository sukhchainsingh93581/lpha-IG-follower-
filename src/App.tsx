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
import { Loader2, Coins } from 'lucide-react';
import { formatCurrency } from './utils';
import { db } from './firebase';
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
