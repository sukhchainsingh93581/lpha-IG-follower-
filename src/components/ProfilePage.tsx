import React, { useState } from 'react';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { ThemeType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { User, Mail, Phone, LogOut, Palette, Check, Edit2, Save, X, ChevronRight, ShieldCheck } from 'lucide-react';
import Swal from 'sweetalert2';

interface ProfilePageProps {
  onAdminAccess?: () => void;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ onAdminAccess }) => {
  const { userData, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [formData, setFormData] = useState({
    name: userData?.name || '',
    phone: userData?.phone || ''
  });

  const handleAdminAccess = async () => {
    const { value: password } = await Swal.fire({
      title: 'Admin Access',
      input: 'password',
      inputLabel: 'Enter Admin Password',
      inputPlaceholder: '••••••••',
      inputAttributes: {
        autocapitalize: 'off',
        autocorrect: 'off'
      },
      showCancelButton: true,
      background: 'var(--card-bg)',
      color: 'var(--text-primary)',
      confirmButtonColor: 'var(--btn-bg)',
      cancelButtonColor: 'rgba(255,255,255,0.1)'
    });

    if (password === '9358197207') {
      onAdminAccess?.();
    } else if (password) {
      Swal.fire({
        icon: 'error',
        title: 'Access Denied',
        text: 'Incorrect admin password.',
        background: 'var(--card-bg)',
        color: 'var(--text-primary)'
      });
    }
  };

  const handleLogout = async () => {
    const result = await Swal.fire({
      title: 'Logout?',
      text: 'Are you sure you want to sign out?',
      icon: 'warning',
      showCancelButton: true,
      background: 'var(--card-bg)',
      color: 'var(--text-primary)',
      confirmButtonColor: 'var(--btn-bg)',
      cancelButtonColor: 'rgba(255,255,255,0.1)'
    });

    if (result.isConfirmed) {
      await signOut(auth);
    }
  };

  const handleUpdateProfile = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        name: formData.name,
        phone: formData.phone
      });
      setIsEditing(false);
      Swal.fire({
        icon: 'success',
        title: 'Profile Updated',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        background: 'var(--card-bg)',
        color: 'var(--text-primary)'
      });
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Update Failed',
        text: error.message,
        background: 'var(--card-bg)',
        color: 'var(--text-primary)'
      });
    }
  };

  const themes: { id: ThemeType; label: string; colors: string[] }[] = [
    { id: 'premium', label: 'Premium Default', colors: ['#667eea', '#764ba2'] },
    { id: 'dark-pro', label: 'Dark Pro', colors: ['#000000', '#00d2ff'] },
    { id: 'royal-gold', label: 'Royal Gold', colors: ['#0f0c29', '#ffd700'] },
    { id: 'light-minimal', label: 'Light Minimal', colors: ['#f0f9ff', '#06b6d4'] },
    { id: 'cyber-neon', label: 'Cyber Neon', colors: ['#0d0221', '#ff00ff'] },
    { id: 'modern-gaming', label: 'Modern Gaming', colors: ['#0a192f', '#4169E1'] },
    { id: 'black-gold', label: 'Premium Black & Gold', colors: ['#121212', '#d4af37'] },
    { id: 'clean-ui', label: 'Light Clean UI', colors: ['#f8f9fa', '#6610f2'] },
    { id: 'neon-cyber', label: 'Neon Cyber', colors: ['#020c1b', '#00f3ff'] },
  ];

  const currentThemeData = themes.find(t => t.id === theme) || themes[0];

  return (
    <div className="space-y-8">
      <header className="mb-8">
        <h2 className="text-sm font-medium text-white/60 uppercase tracking-widest mb-1">Manage Your</h2>
        <h1 className="text-3xl font-bold">Premium Profile</h1>
      </header>

      {/* Profile Card */}
      <div className="glass rounded-[2.5rem] p-8 premium-shadow relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-2xl" />
        
        <div className="flex justify-between items-start mb-8">
          <div className="w-20 h-20 rounded-3xl bg-white/10 flex items-center justify-center border border-white/20">
            <User className="w-10 h-10 text-white/80" />
          </div>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <Edit2 className="w-5 h-5" />
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleUpdateProfile}
                className="w-10 h-10 rounded-full bg-emerald-400/20 text-emerald-400 flex items-center justify-center hover:bg-emerald-400/30 transition-colors"
              >
                <Save className="w-5 h-5" />
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="w-10 h-10 rounded-full bg-rose-400/20 text-rose-400 flex items-center justify-center hover:bg-rose-400/30 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Full Name</p>
            {isEditing ? (
              <input
                type="text"
                className="w-full bg-white/10 border border-white/20 rounded-xl py-2 px-4 focus:outline-none"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            ) : (
              <p className="text-xl font-bold">{userData?.name}</p>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Email</p>
              <div className="flex items-center gap-2 text-white/80">
                <Mail className="w-4 h-4" />
                <p className="text-sm font-medium truncate">{userData?.email}</p>
              </div>
            </div>
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Phone</p>
              {isEditing ? (
                <input
                  type="tel"
                  className="w-full bg-white/10 border border-white/20 rounded-xl py-2 px-4 focus:outline-none"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              ) : (
                <div className="flex items-center gap-2 text-white/80">
                  <Phone className="w-4 h-4" />
                  <p className="text-sm font-medium">{userData?.phone}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Theme Selector Box */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Palette className="w-5 h-5 text-white/60" />
          <h3 className="font-bold text-lg">App Customization</h3>
        </div>

        <button
          onClick={() => setShowThemeModal(true)}
          className="w-full glass rounded-3xl p-6 flex items-center justify-between premium-shadow hover:bg-white/5 transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10">
              <Palette className="w-6 h-6 text-white/80" />
            </div>
            <div className="text-left">
              <p className="text-[10px] text-white/40 uppercase tracking-widest mb-0.5">Current Theme</p>
              <div className="flex items-center gap-2">
                <div className="flex -space-x-1.5">
                  <div className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: currentThemeData.colors[0] }} />
                  <div className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: currentThemeData.colors[1] }} />
                </div>
                <span className="font-bold text-lg">{currentThemeData.label}</span>
              </div>
            </div>
          </div>
          <ChevronRight className="w-6 h-6 text-white/20 group-hover:text-white/60 transition-colors" />
        </button>
      </div>

      {/* Theme Modal */}
      <AnimatePresence>
        {showThemeModal && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center px-4 pb-10">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowThemeModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="relative w-full max-w-md glass rounded-[2.5rem] p-8 premium-shadow space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black tracking-tight">Select Theme</h3>
                <button
                  onClick={() => setShowThemeModal(false)}
                  className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid gap-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                {themes.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setTheme(t.id);
                      setShowThemeModal(false);
                    }}
                    className={`glass rounded-2xl p-4 flex items-center justify-between border transition-all ${
                      theme === t.id ? 'border-white/40 bg-white/20' : 'border-white/5 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex -space-x-2">
                        <div className="w-6 h-6 rounded-full border border-white/20" style={{ backgroundColor: t.colors[0] }} />
                        <div className="w-6 h-6 rounded-full border border-white/20" style={{ backgroundColor: t.colors[1] }} />
                      </div>
                      <span className={`text-sm font-bold ${theme === t.id ? 'text-white' : 'text-white/60'}`}>
                        {t.label}
                      </span>
                    </div>
                    {theme === t.id && (
                      <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center">
                        <Check className="w-4 h-4 text-emerald-500" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Access Button */}
      <button
        onClick={handleAdminAccess}
        className="w-full glass rounded-2xl p-5 flex items-center justify-center gap-3 text-cyan-500 font-bold hover:bg-cyan-500/10 transition-colors border border-cyan-500/20"
      >
        <ShieldCheck className="w-5 h-5" />
        Admin Access
      </button>

      {/* Logout Button */}
      <button
        onClick={handleLogout}
        className="w-full glass rounded-2xl p-5 flex items-center justify-center gap-3 text-rose-400 font-bold hover:bg-rose-400/10 transition-colors border border-rose-400/20"
      >
        <LogOut className="w-5 h-5" />
        Sign Out
      </button>
    </div>
  );
};

export default ProfilePage;
