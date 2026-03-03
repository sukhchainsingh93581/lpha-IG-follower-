import React, { useState } from 'react';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import Swal from 'sweetalert2';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, User, Phone, ArrowRight, Loader2 } from 'lucide-react';

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: ''
  });

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, formData.email, formData.password);
        Swal.fire({
          icon: 'success',
          title: 'Welcome Back!',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000,
          background: 'var(--card-bg)',
          color: 'var(--text-primary)'
        });
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        const user = userCredential.user;

        // Create user document in Firestore
        await setDoc(doc(db, 'users', user.uid), {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          walletBalance: 0,
          selectedTheme: 'premium',
          createdAt: serverTimestamp()
        });

        Swal.fire({
          icon: 'success',
          title: 'Account Created!',
          text: 'Welcome to LuxeServices Premium',
          background: 'var(--card-bg)',
          color: 'var(--text-primary)'
        });
      }
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Authentication Failed',
        text: error.message,
        background: 'var(--card-bg)',
        color: 'var(--text-primary)'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm glass rounded-3xl p-8 premium-shadow"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">LuxeServices</h1>
          <p className="text-white/60">{isLogin ? 'Sign in to your account' : 'Create your premium account'}</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <AnimatePresence mode="wait">
            {!isLogin && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4"
              >
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                  <input
                    type="text"
                    placeholder="Full Name"
                    required
                    className="w-full bg-white/10 border border-white/20 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-white/50 transition-colors"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                  <input
                    type="tel"
                    placeholder="Phone Number"
                    required
                    className="w-full bg-white/10 border border-white/20 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-white/50 transition-colors"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <input
              type="email"
              placeholder="Email Address"
              required
              className="w-full bg-white/10 border border-white/20 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-white/50 transition-colors"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <input
              type="password"
              placeholder="Password"
              required
              className="w-full bg-white/10 border border-white/20 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-white/50 transition-colors"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>

          <button
            disabled={loading}
            className="w-full bg-white text-[#764ba2] font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-white/90 transition-all active:scale-95 disabled:opacity-50"
            style={{ backgroundColor: 'var(--btn-bg)', color: 'var(--btn-text)' }}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                {isLogin ? 'Sign In' : 'Create Account'}
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-white/60 hover:text-white transition-colors"
          >
            {isLogin ? "Don't have an account? Register" : 'Already have an account? Login'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default AuthPage;
