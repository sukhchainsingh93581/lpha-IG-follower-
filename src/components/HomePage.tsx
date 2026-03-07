import React, { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, query, where, addDoc, serverTimestamp, doc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Service } from '../types';
import { formatCurrency } from '../utils';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Send, Info, Link as LinkIcon, Hash, Search, ChevronDown, User } from 'lucide-react';
import Swal from 'sweetalert2';

const HomePage = ({ onOrderSuccess }: { onOrderSuccess?: () => void }) => {
  const { user, userData } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordering, setOrdering] = useState(false);
  
  // Form State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [link, setLink] = useState<string>('');
  const [quantity, setQuantity] = useState<number | ''>('');

  useEffect(() => {
    const qServices = query(collection(db, 'services'), where('enabled', '==', true));
    const unsubscribeServices = onSnapshot(qServices, (snapshot) => {
      const servicesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Service[];
      setServices(servicesData);
      setLoading(false);
    });

    const qCategories = collection(db, 'categories');
    const unsubscribeCategories = onSnapshot(qCategories, (snapshot) => {
      const categoriesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCategories(categoriesData);
    });

    return () => {
      unsubscribeServices();
      unsubscribeCategories();
    };
  }, []);

  const categoryList = useMemo(() => {
    const serviceCats = services.map(s => s.category);
    return Array.from(new Set(serviceCats)).filter(cat => cat).sort();
  }, [services]);

  const filteredServices = useMemo(() => {
    if (!selectedCategory) return [];
    return services.filter(s => {
      const matchesCategory = s.category === selectedCategory;
      const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [services, selectedCategory, searchQuery]);

  const selectedService = useMemo(() => 
    services.find(s => s.id === selectedServiceId), 
    [services, selectedServiceId]
  );

  const totalCost = useMemo(() => {
    if (!selectedService || !quantity || typeof quantity !== 'number') return 0;
    return quantity * selectedService.pricePerUnit;
  }, [selectedService, quantity]);

  const handleOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userData || !selectedService) return;

    if (!link.trim()) {
      return Swal.fire({ icon: 'error', title: 'Missing Link', text: 'Please enter a valid link.', background: 'var(--card-bg)', color: 'var(--text-primary)' });
    }

    const qty = Number(quantity);
    if (isNaN(qty) || qty < selectedService.minQty || qty > selectedService.maxQty) {
      return Swal.fire({ 
        icon: 'error', 
        title: 'Invalid Quantity', 
        text: `Quantity must be between ${selectedService.minQty} and ${selectedService.maxQty}.`,
        background: 'var(--card-bg)', 
        color: 'var(--text-primary)' 
      });
    }

    const currentBalance = userData.walletBalance || userData.balance || 0;
    if (currentBalance < totalCost) {
      return Swal.fire({ 
        icon: 'error', 
        title: 'Insufficient Balance', 
        text: `You need ${formatCurrency(totalCost)} but your balance is ${formatCurrency(currentBalance)}.`,
        background: 'var(--card-bg)', 
        color: 'var(--text-primary)' 
      });
    }

    setOrdering(true);

    try {
      // 1. Call SMM API via backend
      const apiResponse = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: selectedService.api_service_id || selectedService.id,
          link: link,
          quantity: qty
        })
      });

      if (!apiResponse.ok) {
        if (apiResponse.status === 404) {
          throw new Error("API Route not found. If you are on Netlify, please note that Netlify does not support the backend server. Use Render or Railway instead.");
        }
        const errorData = await apiResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${apiResponse.status}`);
      }

      const apiData = await apiResponse.json();

      if (apiData.error) {
        throw new Error(apiData.error);
      }

      if (!apiData.order) {
        throw new Error(apiData.error || 'Failed to place order on API');
      }

      // 2. Update Firebase via transaction
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await transaction.get(userRef);
        
        if (!userSnap.exists()) throw new Error("User does not exist!");
        
        const userData = userSnap.data();
        const currentBalance = userData.walletBalance || userData.balance || 0;
        
        if (currentBalance < totalCost) throw new Error("Insufficient balance!");

        transaction.update(userRef, {
          walletBalance: currentBalance - totalCost,
          balance: currentBalance - totalCost
        });

        const orderRef = doc(collection(db, 'orders'));
        transaction.set(orderRef, {
          userId: user.uid,
          userName: userData.name || 'Anonymous',
          userEmail: user.email || '',
          serviceId: selectedService.id,
          api_service_id: selectedService.api_service_id || '',
          api_order_id: apiData.order.toString(),
          serviceName: selectedService.name,
          category: selectedCategory,
          link: link,
          quantity: qty,
          pricePerUnit: selectedService.pricePerUnit,
          totalCost: totalCost,
          status: 'Pending',
          createdAt: serverTimestamp()
        });
      });

      Swal.fire({
        icon: 'success',
        title: 'Order Placed!',
        text: `Successfully ordered ${qty} ${selectedService.name}. Your order is now Pending.`,
        background: 'var(--card-bg)',
        color: 'var(--text-primary)',
        confirmButtonColor: 'var(--btn-bg)',
        showCancelButton: true,
        confirmButtonText: 'View Orders',
        cancelButtonText: 'Close'
      }).then((result) => {
        if (result.isConfirmed && onOrderSuccess) {
          onOrderSuccess();
        }
      });

      setLink('');
      setQuantity('');
      setSelectedServiceId('');

    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Order Failed',
        text: error.message,
        background: 'var(--card-bg)',
        color: 'var(--text-primary)'
      });
    } finally {
      setOrdering(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-white/50" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
        <input
          type="text"
          placeholder="Search for a service..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full glass rounded-2xl py-4 pl-14 pr-5 focus:outline-none focus:ring-2 ring-cyan-100 transition-all shadow-sm"
          style={{ color: 'var(--text-primary)' }}
        />
      </div>

      {/* Category Selection */}
      <div className="space-y-2">
        <label className="text-sm font-bold opacity-80 ml-1" style={{ color: 'var(--text-primary)' }}>Category</label>
        <div className="relative">
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setSelectedServiceId('');
            }}
            className="w-full glass rounded-2xl py-4 px-5 appearance-none focus:outline-none focus:ring-2 ring-cyan-100 transition-all cursor-pointer font-medium shadow-sm"
            style={{ color: 'var(--text-primary)' }}
          >
            <option value="">Select Category</option>
            {categoryList.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 w-5 h-5" />
        </div>
      </div>

      {/* Service Selection */}
      <div className="space-y-2">
        <label className="text-sm font-bold opacity-80 ml-1" style={{ color: 'var(--text-primary)' }}>Service</label>
        <div className="relative">
          <select
            value={selectedServiceId}
            disabled={!selectedCategory}
            onChange={(e) => setSelectedServiceId(e.target.value)}
            className={`w-full glass rounded-2xl py-4 px-5 appearance-none focus:outline-none focus:ring-2 ring-cyan-100 transition-all font-medium shadow-sm ${!selectedCategory ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            style={{ color: 'var(--text-primary)' }}
          >
            <option value="">{selectedCategory ? 'Choose a service...' : 'Select category first'}</option>
            {filteredServices.map((service) => (
              <option key={service.id} value={service.id}>
                {service.emoji} {service.name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 w-5 h-5" />
        </div>
      </div>

      {/* Service Details Card */}
      <AnimatePresence mode="wait">
        {selectedService && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="glass rounded-3xl p-6 space-y-4 shadow-sm"
          >
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-cyan-50 flex items-center justify-center shrink-0">
                <User className="w-8 h-8 text-cyan-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg leading-tight" style={{ color: 'var(--text-primary)' }}>{selectedService.emoji} {selectedService.name}</h3>
                <p className="text-cyan-600 font-black text-lg mt-1">₹{selectedService.pricePerUnit} per unit</p>
                <p className="text-xs opacity-40 mt-1" style={{ color: 'var(--text-primary)' }}>Min: {selectedService.minQty} - Max: {selectedService.maxQty.toLocaleString()}</p>
              </div>
            </div>
            
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-4 h-4 opacity-40" style={{ color: 'var(--text-primary)' }} />
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-40" style={{ color: 'var(--text-primary)' }}>Service Description</span>
              </div>
              <p className="text-sm opacity-80 leading-relaxed whitespace-pre-line" style={{ color: 'var(--text-primary)' }}>{selectedService.description}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Link Input */}
      <div className="space-y-2">
        <label className="text-sm font-bold opacity-80 ml-1" style={{ color: 'var(--text-primary)' }}>Link</label>
        <input
          type="url"
          placeholder="Enter Instagram Link"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          className="w-full glass rounded-2xl py-4 px-6 focus:outline-none focus:ring-2 ring-cyan-200 transition-all"
          style={{ color: 'var(--text-primary)' }}
        />
      </div>

      {/* Quantity Input */}
      <div className="space-y-2">
        <label className="text-sm font-bold opacity-80 ml-1" style={{ color: 'var(--text-primary)' }}>Quantity</label>
        <input
          type="number"
          placeholder="Enter Quantity"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
          className="w-full glass rounded-2xl py-4 px-6 focus:outline-none focus:ring-2 ring-cyan-200 transition-all"
          style={{ color: 'var(--text-primary)' }}
        />
        {selectedService && (
          <p className="text-[10px] opacity-40 ml-1" style={{ color: 'var(--text-primary)' }}>Min: {selectedService.minQty} - Max: {selectedService.maxQty.toLocaleString()}</p>
        )}
      </div>

      {/* Charge Display */}
      <div className="space-y-2">
        <label className="text-sm font-bold opacity-80 ml-1" style={{ color: 'var(--text-primary)' }}>Charge</label>
        <div className="w-full glass rounded-2xl py-4 px-6 font-bold text-xl text-cyan-400">
          ₹{totalCost.toFixed(2)}
        </div>
      </div>

      {/* Submit Button */}
      <button
        onClick={handleOrder}
        disabled={ordering || !selectedService || !link || !quantity}
        className="w-full bg-cyan-500 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 hover:bg-cyan-600 transition-all active:scale-[0.98] disabled:opacity-30 shadow-lg shadow-cyan-200"
      >
        {ordering ? (
          <Loader2 className="w-6 h-6 animate-spin" />
        ) : (
          <>
            <Send className="w-5 h-5" />
            Submit
          </>
        )}
      </button>
    </div>
  );
};

export default HomePage;
