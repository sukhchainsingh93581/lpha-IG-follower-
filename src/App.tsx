import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import AuthPage from './components/AuthPage';
import HomePage from './components/HomePage';
import OrdersPage from './components/OrdersPage';
import WalletPage from './components/WalletPage';
import NotificationsPage from './components/NotificationsPage';
import ProfilePage from './components/ProfilePage';
import ReferPage from './components/ReferPage';
import BottomNav from './components/BottomNav';
import AdminPanel from './components/AdminPanel';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Coins, ShieldAlert, Settings } from 'lucide-react';
import Swal from 'sweetalert2';
import { formatCurrency } from './utils';
import { db, auth } from './firebase';
import { doc, onSnapshot, collection, getDocs, writeBatch, query, limit, addDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { useEffect } from 'react';

const AppContent = () => {
  const { user, userData, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('home');
  const [isAdminView, setIsAdminView] = useState(false);
  const [showReferPage, setShowReferPage] = useState(false);
  const [appName, setAppName] = useState('InstaBoost');
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    if (refCode) {
      localStorage.setItem('pending_referral_code', refCode);
    }
  }, []);

  useEffect(() => {
    const syncServices = async () => {
      try {
        const configSnap = await getDoc(doc(db, 'settings', 'app_config'));
        const markup = configSnap.exists() ? (configSnap.data().serviceMarkup || 0) : 0;

        const response = await fetch('/api/services');
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("API Route not found. If you are on Netlify, please note that Netlify does not support the backend server. Use Render or Railway instead.");
          }
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Server error: ${response.status}`);
        }
        const apiServices = await response.json();
        
        if (Array.isArray(apiServices)) {
          // Sync Categories
          const apiCategories = [...new Set(apiServices.map((s: any) => s.category))];
          const categoriesRef = collection(db, 'categories');
          const categoriesSnap = await getDocs(categoriesRef);
          const existingCategories = new Set(categoriesSnap.docs.map(doc => doc.data().name));

          for (const catName of apiCategories) {
            if (!existingCategories.has(catName)) {
              await addDoc(categoriesRef, {
                name: catName,
                icon: '✨',
                createdAt: serverTimestamp()
              });
            }
          }

          const servicesRef = collection(db, 'services');
          const existingServicesSnap = await getDocs(query(servicesRef, limit(1)));
          
          if (existingServicesSnap.empty) {
            const batch = writeBatch(db);
            apiServices.forEach((s: any) => {
              const newDocRef = doc(servicesRef);
              const basePrice = parseFloat(s.rate) / 1000;
              const finalPrice = basePrice * (1 + markup / 100);
              
              batch.set(newDocRef, {
                api_service_id: s.service.toString(),
                name: s.name,
                category: s.category,
                emoji: '✨',
                description: s.name,
                basePrice: basePrice,
                pricePerUnit: Number(finalPrice.toFixed(4)),
                minQty: parseInt(s.min),
                maxQty: parseInt(s.max),
                enabled: true,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
              });
            });
            await batch.commit();
            console.log('Services synced from API');
          }
        }
      } catch (error) {
        console.error('Error syncing services:', error);
      }
    };

    syncServices();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'app_config'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setAppName(data.appName || 'InstaBoost');
        setIsMaintenanceMode(data.isMaintenanceMode || false);
      }
    });
    return () => unsub();
  }, []);

  const handleAdminAccess = async () => {
    const { value: password } = await Swal.fire({
      title: 'Admin Access',
      input: 'password',
      inputLabel: 'Enter Admin Password',
      inputPlaceholder: '••••••••',
      showCancelButton: true,
      confirmButtonColor: '#06b6d4',
    });

    if (password === 'Admin93581') {
      setIsAdminView(true);
    } else if (password) {
      Swal.fire({
        icon: 'error',
        title: 'Access Denied',
        text: 'Incorrect admin password.',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-12 h-12 animate-spin text-white" />
      </div>
    );
  }

  if (isMaintenanceMode && !isAdminView) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center space-y-8 bg-slate-900">
        <div className="w-24 h-24 bg-cyan-500/10 rounded-full flex items-center justify-center">
          <Settings className="w-12 h-12 text-cyan-500 animate-spin" />
        </div>
        <div className="space-y-3">
          <h1 className="text-3xl font-black text-white tracking-tight">App Management</h1>
          <p className="text-slate-400 font-medium max-w-xs mx-auto">
            The application is currently undergoing maintenance. Please check back later.
          </p>
        </div>
        <div className="flex flex-col w-full max-w-xs gap-4">
          <button 
            onClick={() => window.history.back()}
            className="w-full bg-slate-800 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-700 transition-all"
          >
            Back
          </button>
          <button 
            onClick={handleAdminAccess}
            className="w-full bg-cyan-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-cyan-500/20 hover:scale-105 transition-all"
          >
            Admin Access
          </button>
        </div>
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
    if (showReferPage) {
      return <ReferPage onBack={() => setShowReferPage(false)} />;
    }

    switch (activeTab) {
      case 'home': return <HomePage onOrderSuccess={() => setActiveTab('orders')} />;
      case 'orders': return <OrdersPage />;
      case 'wallet': return <WalletPage />;
      case 'notifications': return <NotificationsPage />;
      case 'profile': return <ProfilePage 
        onAdminAccess={() => setIsAdminView(true)} 
        onReferAccess={() => setShowReferPage(true)}
      />;
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
      
      <BottomNav activeTab={activeTab} setActiveTab={(tab) => {
        setActiveTab(tab);
        setShowReferPage(false);
      }} />
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
