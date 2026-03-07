import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Order } from '../types';
import { formatCurrency, formatDate } from '../utils';
import { motion, AnimatePresence } from 'motion/react';
import { ClipboardList, Clock, CheckCircle2, XCircle, Loader2, RefreshCcw } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';

const OrdersPage = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const checkStatus = async (order: Order) => {
    if (!order.api_order_id) return;
    try {
      const response = await fetch(`/api/order-status/${order.api_order_id}`);
      const data = await response.json();
      
      if (data.status) {
        let newStatus = data.status;
        // Map API status to local status if needed
        if (newStatus === 'Pending') newStatus = 'Pending';
        if (newStatus === 'Processing') newStatus = 'Processing';
        if (newStatus === 'Completed') newStatus = 'Completed';
        if (newStatus === 'Canceled' || newStatus === 'Partial') newStatus = 'Cancelled';
        
        if (newStatus !== order.status) {
          await updateDoc(doc(db, 'orders', order.id), {
            status: newStatus,
            updatedAt: new Date()
          });
        }
      }
    } catch (error) {
      console.error('Error checking status:', error);
    }
  };

  const refreshStatuses = async () => {
    setRefreshing(true);
    const pendingOrders = orders.filter(o => o.status === 'Pending' || o.status === 'Processing');
    for (const order of pendingOrders) {
      await checkStatus(order);
    }
    setRefreshing(false);
  };

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'orders'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Order[];
      
      // Sort client-side to avoid missing index errors
      ordersData.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });

      setOrders(ordersData);
      setLoading(false);
    }, (error) => {
      console.error("Orders fetch error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Pending': return <Clock className="w-4 h-4 text-yellow-400" />;
      case 'Processing': return <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />;
      case 'Completed': return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'Cancelled': return <XCircle className="w-4 h-4 text-rose-400" />;
      default: return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'Pending': return 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20';
      case 'Processing': return 'bg-cyan-400/10 text-cyan-400 border-cyan-400/20';
      case 'Completed': return 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20';
      case 'Cancelled': return 'bg-rose-400/10 text-rose-400 border-rose-400/20';
      default: return 'bg-slate-400/10 text-slate-400 border-slate-400/20';
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
    <div className="space-y-6">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium opacity-60 uppercase tracking-widest mb-1" style={{ color: 'var(--text-primary)' }}>Track Your</h2>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>Premium Orders</h1>
        </div>
        <button 
          onClick={refreshStatuses}
          disabled={refreshing}
          className="p-3 glass rounded-2xl hover:bg-white/10 transition-all active:scale-95 disabled:opacity-50"
        >
          <RefreshCcw className={`w-5 h-5 text-cyan-400 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {orders.length === 0 ? (
        <div className="glass rounded-3xl p-12 text-center">
          <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-20" style={{ color: 'var(--text-primary)' }} />
          <p className="opacity-60" style={{ color: 'var(--text-primary)' }}>No orders placed yet.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          <AnimatePresence>
            {orders.map((order) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="glass rounded-2xl p-5 premium-shadow border border-white/5"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-white/10 opacity-60 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest" style={{ color: 'var(--text-primary)' }}>
                        {order.category || 'Service'}
                      </span>
                    </div>
                    <h3 className="font-bold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>{order.serviceName}</h3>
                    <p className="text-xs opacity-40" style={{ color: 'var(--text-primary)' }}>{formatDate(order.createdAt)}</p>
                  </div>
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold ${getStatusClass(order.status)}`}>
                    {getStatusIcon(order.status)}
                    {order.status}
                  </div>
                </div>

                <div className="space-y-3 py-4 border-y border-white/5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] opacity-40 uppercase tracking-widest font-bold" style={{ color: 'var(--text-primary)' }}>Target Link</span>
                    <span className="text-xs opacity-80 font-medium truncate max-w-[200px]" style={{ color: 'var(--text-primary)' }}>{order.link}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] opacity-40 uppercase tracking-widest font-bold" style={{ color: 'var(--text-primary)' }}>Quantity</span>
                    <span className="text-sm opacity-90 font-black" style={{ color: 'var(--text-primary)' }}>{order.quantity}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-4">
                  <span className="text-xs opacity-40 uppercase tracking-widest font-bold" style={{ color: 'var(--text-primary)' }}>Total Cost</span>
                  <span className="font-black text-xl text-cyan-400">{formatCurrency(order.totalCost || order.price || 0)}</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default OrdersPage;
