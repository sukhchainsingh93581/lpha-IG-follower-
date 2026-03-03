import React from 'react';
import { Home, ClipboardList, Wallet, Bell, User } from 'lucide-react';
import { motion } from 'motion/react';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'orders', icon: ClipboardList, label: 'Orders' },
    { id: 'wallet', icon: Wallet, label: 'Wallet' },
    { id: 'notifications', icon: Bell, label: 'Alerts' },
    { id: 'profile', icon: User, label: 'Profile' },
  ];

  return (
    <nav className="fixed bottom-6 left-4 right-4 h-16 bg-white border border-slate-100 rounded-2xl flex items-center justify-around px-2 z-50 shadow-xl shadow-slate-200/50">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="relative flex flex-col items-center justify-center w-12 h-12 transition-colors"
          >
            {isActive && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-cyan-50 rounded-xl"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
              />
            )}
            <Icon
              className={`w-6 h-6 z-10 transition-all duration-300 ${
                isActive ? 'text-cyan-500 scale-110' : 'text-slate-400'
              }`}
            />
            {isActive && (
              <motion.span
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[10px] font-bold mt-1 z-10 text-cyan-500"
              >
                {tab.label}
              </motion.span>
            )}
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNav;
