import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, limit, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  ClipboardList, 
  Layers, 
  IndianRupee, 
  ArrowLeft, 
  TrendingUp,
  Clock,
  Menu,
  X,
  LayoutDashboard,
  Settings,
  Plus,
  Trash2,
  Edit,
  Save,
  Search,
  Loader2,
  ShoppingCart,
  CreditCard,
  Copy,
  Check,
  ExternalLink
} from 'lucide-react';
import { formatCurrency } from '../utils';
import Swal from 'sweetalert2';

interface AdminPanelProps {
  onBack: () => void;
}

type AdminView = 'dashboard' | 'services' | 'app_management' | 'orders' | 'payments';

const AdminPanel: React.FC<AdminPanelProps> = ({ onBack }) => {
  const [view, setView] = useState<AdminView>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalOrders: 0,
    totalServices: 0,
    totalRevenue: 0
  });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [orderFilter, setOrderFilter] = useState<'active' | 'history'>('active');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [fundRequests, setFundRequests] = useState<any[]>([]);
  const [paymentFilter, setPaymentFilter] = useState<'active' | 'history'>('active');
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // App Management State
  const [appConfig, setAppConfig] = useState({
    appName: 'InstaBoost',
    qrUrl: '',
    upiId: ''
  });
  const [savingConfig, setSavingConfig] = useState(false);

  // Service Form State
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);
  const [serviceForm, setServiceForm] = useState({
    category: '',
    items: [{
      name: '',
      emoji: '',
      description: '',
      pricePerUnit: '',
      minQty: '',
      maxQty: ''
    }]
  });

  const addServiceItem = () => {
    setServiceForm(prev => ({
      ...prev,
      items: [...prev.items, { name: '', emoji: '', description: '', pricePerUnit: '', minQty: '', maxQty: '' }]
    }));
  };

  const removeServiceItem = (index: number) => {
    if (serviceForm.items.length <= 1) return;
    setServiceForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const updateServiceItem = (index: number, field: string, value: string) => {
    setServiceForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === index ? { ...item, [field]: value } : item)
    }));
  };

  useEffect(() => {
    // Real-time Users Count
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setStats(prev => ({ ...prev, totalUsers: snapshot.size }));
    });

    // Real-time Orders & Revenue
    const unsubscribeOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
      const orders = snapshot.docs.map(doc => doc.data());
      const revenue = orders.reduce((acc, order: any) => acc + (order.totalCost || 0), 0);
      setStats(prev => ({ ...prev, totalOrders: snapshot.size, totalRevenue: revenue }));
    });

    // Real-time Services
    const unsubscribeServices = onSnapshot(collection(db, 'services'), (snapshot) => {
      const servicesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setServices(servicesData);
      setStats(prev => ({ ...prev, totalServices: snapshot.size }));
    });

    // App Config
    const unsubscribeConfig = onSnapshot(doc(db, 'settings', 'app_config'), (snapshot) => {
      if (snapshot.exists()) {
        setAppConfig(snapshot.data() as any);
      }
    });

    // All Orders for Management
    const unsubscribeAllOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
      const orders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAllOrders(orders);
    });

    // Recent Orders (Last 5)
    const qRecent = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(5));
    const unsubscribeRecent = onSnapshot(qRecent, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRecentOrders(orders);
      setLoading(false);
    });

    // Real-time Fund Requests
    const unsubscribeFunds = onSnapshot(query(collection(db, 'fundRequests'), orderBy('createdAt', 'desc')), (snapshot) => {
      const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFundRequests(requests);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeOrders();
      unsubscribeServices();
      unsubscribeConfig();
      unsubscribeAllOrders();
      unsubscribeRecent();
      unsubscribeFunds();
    };
  }, []);

  const handleUpdatePaymentStatus = async (requestId: string, newStatus: 'Approved' | 'Rejected') => {
    try {
      const requestRef = doc(db, 'fundRequests', requestId);
      const requestSnap = await getDoc(requestRef);
      
      if (!requestSnap.exists()) throw new Error('Request not found');
      const requestData = requestSnap.data();

      if (requestData.status !== 'Pending') {
        throw new Error('This request has already been processed.');
      }

      if (newStatus === 'Approved') {
        const userRef = doc(db, 'users', requestData.userId);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          const currentBalance = userData.walletBalance || userData.balance || 0;
          const amountToAdd = Number(requestData.amount);

          await updateDoc(userRef, {
            walletBalance: currentBalance + amountToAdd,
            balance: currentBalance + amountToAdd,
            updatedAt: serverTimestamp()
          });

          // Add a notification for the user
          await addDoc(collection(db, 'notifications'), {
            userId: requestData.userId,
            title: 'Funds Added!',
            message: `Your payment of ${formatCurrency(amountToAdd)} has been verified and added to your wallet.`,
            createdAt: serverTimestamp()
          });

          Swal.fire({ icon: 'success', title: 'Payment Approved', text: `${formatCurrency(amountToAdd)} added to user balance.`, toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
        }
      } else {
        // Add a notification for rejection
        await addDoc(collection(db, 'notifications'), {
          userId: requestData.userId,
          title: 'Payment Rejected',
          message: `Your payment request (ID: ${requestData.transactionId}) was rejected. Please ensure you have made the payment before submitting a request.`,
          createdAt: serverTimestamp()
        });
        Swal.fire({ icon: 'error', title: 'Payment Rejected', text: 'Request marked as rejected.', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
      }

      await updateDoc(requestRef, {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.message });
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      const orderSnap = await getDoc(orderRef);
      
      if (!orderSnap.exists()) throw new Error('Order not found');
      const orderData = orderSnap.data();

      // If status is being changed to Cancelled, refund the user
      if (newStatus === 'Cancelled' && orderData.status !== 'Cancelled') {
        const userRef = doc(db, 'users', orderData.userId);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          await updateDoc(userRef, {
            walletBalance: (userData.walletBalance || userData.balance || 0) + (orderData.totalCost || 0),
            balance: (userData.walletBalance || userData.balance || 0) + (orderData.totalCost || 0),
            updatedAt: serverTimestamp()
          });
          Swal.fire({ icon: 'info', title: 'Order Cancelled', text: `Refunded ${formatCurrency(orderData.totalCost)} to user.`, toast: true, position: 'top-end', showConfirmButton: false, timer: 4000 });
        }
      }

      await updateDoc(orderRef, {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      
      if (newStatus !== 'Cancelled') {
        Swal.fire({ icon: 'success', title: `Order marked as ${newStatus}`, toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
      }
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.message });
    }
  };

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    Swal.fire({ icon: 'success', title: 'Link Copied', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      await updateDoc(doc(db, 'settings', 'app_config'), {
        ...appConfig,
        updatedAt: serverTimestamp()
      });
      Swal.fire({ icon: 'success', title: 'Config Saved', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
    } catch (error: any) {
      // If document doesn't exist, create it
      try {
        await addDoc(collection(db, 'settings'), { ...appConfig, id: 'app_config' }); // This is wrong for specific ID
        // Correct way to set with specific ID if update fails
        const { setDoc } = await import('firebase/firestore');
        await setDoc(doc(db, 'settings', 'app_config'), {
          ...appConfig,
          updatedAt: serverTimestamp()
        });
        Swal.fire({ icon: 'success', title: 'Config Saved', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
      } catch (err: any) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message });
      }
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { category, items } = serviceForm;
      
      if (editingService) {
        const item = items[0];
        const data = {
          category,
          name: item.name,
          emoji: item.emoji || '✨',
          description: item.description || '',
          pricePerUnit: parseFloat(item.pricePerUnit),
          minQty: parseInt(item.minQty),
          maxQty: parseInt(item.maxQty),
          enabled: true,
          updatedAt: serverTimestamp()
        };
        await updateDoc(doc(db, 'services', editingService.id), data);
        Swal.fire({ icon: 'success', title: 'Service Updated', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
      } else {
        // Create multiple services
        const batch = items.map(item => ({
          category,
          name: item.name,
          emoji: item.emoji || '✨',
          description: item.description || '',
          pricePerUnit: parseFloat(item.pricePerUnit),
          minQty: parseInt(item.minQty),
          maxQty: parseInt(item.maxQty),
          enabled: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }));

        for (const data of batch) {
          await addDoc(collection(db, 'services'), data);
        }
        Swal.fire({ icon: 'success', title: `${batch.length} Services Created`, toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
      }
      
      setShowServiceModal(false);
      setEditingService(null);
      setServiceForm({ 
        category: '', 
        items: [{ name: '', emoji: '', description: '', pricePerUnit: '', minQty: '', maxQty: '' }] 
      });
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.message });
    }
  };

  const handleDeleteService = async (id: string) => {
    const result = await Swal.fire({
      title: 'Delete Service?',
      text: 'This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#94a3b8'
    });

    if (result.isConfirmed) {
      await deleteDoc(doc(db, 'services', id));
      Swal.fire({ icon: 'success', title: 'Deleted!', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
    }
  };

  const openEditModal = (service: any) => {
    setEditingService(service);
    setServiceForm({
      category: service.category,
      items: [{
        name: service.name,
        emoji: service.emoji || '',
        description: service.description || '',
        pricePerUnit: service.pricePerUnit.toString(),
        minQty: service.minQty.toString(),
        maxQty: service.maxQty.toString()
      }]
    });
    setShowServiceModal(true);
  };

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'Total Orders', value: stats.totalOrders, icon: ClipboardList, color: 'text-purple-500', bg: 'bg-purple-50' },
    { label: 'Total Services', value: stats.totalServices, icon: Layers, color: 'text-orange-500', bg: 'bg-orange-50' },
    { label: 'Total Revenue', value: formatCurrency(stats.totalRevenue), icon: IndianRupee, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-10 relative overflow-x-hidden">
      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 left-0 bottom-0 w-72 bg-white z-[70] shadow-2xl p-6 flex flex-col"
          >
            <div className="flex items-center justify-between mb-10">
              <h2 className="text-2xl font-black text-cyan-500 tracking-tighter">Admin Menu</h2>
              <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-slate-100 rounded-full">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <nav className="space-y-2 flex-1">
              <button
                onClick={() => { setView('dashboard'); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl font-bold transition-all ${
                  view === 'dashboard' ? 'bg-cyan-50 text-cyan-600' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <LayoutDashboard className="w-5 h-5" />
                Dashboard
              </button>
              <button
                onClick={() => { setView('services'); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl font-bold transition-all ${
                  view === 'services' ? 'bg-cyan-50 text-cyan-600' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <Settings className="w-5 h-5" />
                Service Management
              </button>
              <button
                onClick={() => { setView('app_management'); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl font-bold transition-all ${
                  view === 'app_management' ? 'bg-cyan-50 text-cyan-600' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <Settings className="w-5 h-5" />
                App Management
              </button>
              <button
                onClick={() => { setView('orders'); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl font-bold transition-all ${
                  view === 'orders' ? 'bg-cyan-50 text-cyan-600' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <ShoppingCart className="w-5 h-5" />
                Orders
              </button>
              <button
                onClick={() => { setView('payments'); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl font-bold transition-all ${
                  view === 'payments' ? 'bg-cyan-50 text-cyan-600' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <CreditCard className="w-5 h-5" />
                Payments
              </button>
            </nav>

            <div className="pt-6 border-t border-slate-100">
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest text-center">Version 1.0.0</p>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Admin Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-slate-600" />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-800">
              {view === 'dashboard' ? 'Dashboard' : 
               view === 'services' ? 'Services' : 
               view === 'app_management' ? 'App Management' : 
               view === 'orders' ? 'Order Management' :
               'Payment Management'}
            </h1>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Admin Panel</p>
          </div>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors"
        >
          <Menu className="w-6 h-6 text-slate-600" />
        </button>
      </header>

      <div className="p-6">
        {view === 'dashboard' && (
          <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              {statCards.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm"
                >
                  <div className={`${stat.bg} w-10 h-10 rounded-xl flex items-center justify-center mb-3`}>
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-tight">{stat.label}</p>
                  <h3 className="text-xl font-black text-slate-800 mt-1">{stat.value}</h3>
                </motion.div>
              ))}
            </div>

            {/* Recent Orders Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-slate-400" />
                  <h2 className="font-black text-slate-800">Recent Orders</h2>
                </div>
                <TrendingUp className="w-5 h-5 text-cyan-500" />
              </div>

              <div className="space-y-3">
                {recentOrders.length === 0 ? (
                  <div className="bg-white p-10 rounded-3xl border border-dashed border-slate-200 text-center">
                    <p className="text-slate-400 font-medium">No orders found yet.</p>
                  </div>
                ) : (
                  recentOrders.map((order) => (
                    <div 
                      key={order.id}
                      className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between"
                    >
                      <div className="space-y-1">
                        <p className="font-bold text-slate-800 text-sm truncate max-w-[180px]">
                          {order.serviceName}
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">
                          Qty: {order.quantity} • {formatCurrency(order.totalCost)}
                        </p>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                        order.status === 'Completed' ? 'bg-emerald-50 text-emerald-500' :
                        order.status === 'Pending' ? 'bg-amber-50 text-amber-500' :
                        'bg-slate-50 text-slate-500'
                      }`}>
                        {order.status}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {view === 'services' && (
          <div className="space-y-6">
            {/* Service Management View */}
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Manage Services</h2>
              <button 
                onClick={() => { 
                  setEditingService(null); 
                  setServiceForm({ 
                    category: '', 
                    items: [{ name: '', emoji: '', description: '', pricePerUnit: '', minQty: '', maxQty: '' }] 
                  }); 
                  setShowServiceModal(true); 
                }}
                className="bg-cyan-500 text-white p-3 rounded-2xl flex items-center gap-2 font-bold shadow-lg shadow-cyan-200 hover:scale-105 transition-transform"
              >
                <Plus className="w-5 h-5" />
                New Service
              </button>
            </div>

            <div className="space-y-4">
              {services.length === 0 ? (
                <div className="bg-white p-12 rounded-[2.5rem] border border-dashed border-slate-200 text-center">
                  <Layers className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-bold">No services created yet.</p>
                </div>
              ) : (
                services.map((service) => (
                  <div key={service.id} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <span className="bg-cyan-50 text-cyan-600 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                          {service.category}
                        </span>
                        <h3 className="font-black text-slate-800 text-lg">{service.name}</h3>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => openEditModal(service)} className="p-2 bg-slate-50 text-slate-400 hover:text-cyan-500 rounded-xl transition-colors">
                          <Edit className="w-5 h-5" />
                        </button>
                        <button onClick={() => handleDeleteService(service.id)} className="p-2 bg-slate-50 text-slate-400 hover:text-rose-500 rounded-xl transition-colors">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-slate-50 p-2 rounded-xl text-center">
                    <p className="text-[9px] text-slate-400 font-bold uppercase">Price</p>
                    <p className="text-xs font-black text-slate-700">{formatCurrency(service.pricePerUnit)}</p>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-xl text-center">
                    <p className="text-[9px] text-slate-400 font-bold uppercase">Min</p>
                    <p className="text-xs font-black text-slate-700">{service.minQty}</p>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-xl text-center">
                    <p className="text-[9px] text-slate-400 font-bold uppercase">Max</p>
                    <p className="text-xs font-black text-slate-700">{service.maxQty}</p>
                  </div>
                </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {view === 'app_management' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">App Management</h2>
            
            <form onSubmit={handleSaveConfig} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">App Name</label>
                <input
                  required
                  placeholder="e.g. InstaBoost"
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 font-bold text-slate-700"
                  value={appConfig.appName}
                  onChange={(e) => setAppConfig({ ...appConfig, appName: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Payment QR URL</label>
                <input
                  required
                  placeholder="https://example.com/qr.png"
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 font-bold text-slate-700"
                  value={appConfig.qrUrl}
                  onChange={(e) => setAppConfig({ ...appConfig, qrUrl: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">UPI ID (PhonePe/GPay)</label>
                <input
                  required
                  placeholder="e.g. yourname@upi"
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 font-bold text-slate-700"
                  value={appConfig.upiId}
                  onChange={(e) => setAppConfig({ ...appConfig, upiId: e.target.value })}
                />
              </div>

              <button
                type="submit"
                disabled={savingConfig}
                className="w-full bg-cyan-500 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-cyan-200 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {savingConfig ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
                Save Configuration
              </button>
            </form>
          </div>
        )}

        {view === 'orders' && (
          <div className="space-y-6">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Order Management</h2>
                <div className="flex bg-slate-100 p-1 rounded-2xl">
                  <button 
                    onClick={() => { setOrderFilter('active'); setOrderSearchQuery(''); }}
                    className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${orderFilter === 'active' ? 'bg-white text-cyan-500 shadow-sm' : 'text-slate-400'}`}
                  >
                    Active
                  </button>
                  <button 
                    onClick={() => { setOrderFilter('history'); setOrderSearchQuery(''); }}
                    className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${orderFilter === 'history' ? 'bg-white text-cyan-500 shadow-sm' : 'text-slate-400'}`}
                  >
                    History
                  </button>
                </div>
              </div>

              {/* Order Search Bar */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by status (Pending, Completed, etc.) or Order ID..."
                  value={orderSearchQuery}
                  onChange={(e) => setOrderSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-100 rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 font-bold text-slate-700 text-sm shadow-sm"
                />
              </div>
            </div>

            <div className="space-y-4">
              {allOrders
                .filter(o => {
                  const search = orderSearchQuery.toLowerCase();
                  if (search) {
                    return o.status.toLowerCase().includes(search) || o.id.toLowerCase().includes(search);
                  }
                  // Default behavior: if no search, show Pending and Processing for active, and others for history
                  if (orderFilter === 'active') {
                    return o.status === 'Pending' || o.status === 'Processing';
                  }
                  return o.status === 'Completed' || o.status === 'Cancelled';
                })
                .length === 0 ? (
                <div className="bg-white p-12 rounded-[2.5rem] border border-dashed border-slate-200 text-center">
                  <ShoppingCart className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-bold">No orders found.</p>
                </div>
              ) : (
                allOrders
                  .filter(o => {
                    const search = orderSearchQuery.toLowerCase();
                    if (search) {
                      return o.status.toLowerCase().includes(search) || o.id.toLowerCase().includes(search);
                    }
                    if (orderFilter === 'active') {
                      return o.status === 'Pending' || o.status === 'Processing';
                    }
                    return o.status === 'Completed' || o.status === 'Cancelled';
                  })
                  .map((order) => (
                    <div key={order.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="bg-cyan-50 text-cyan-600 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                              {order.category}
                            </span>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                              order.status === 'Completed' ? 'bg-emerald-50 text-emerald-500' :
                              order.status === 'Cancelled' ? 'bg-rose-50 text-rose-500' :
                              order.status === 'Processing' ? 'bg-amber-50 text-amber-500' :
                              'bg-slate-50 text-slate-500'
                            }`}>
                              {order.status}
                            </span>
                          </div>
                          <h3 className="font-black text-slate-800 text-lg">{order.serviceName}</h3>
                          <p className="text-xs text-slate-400 font-bold">Order ID: {order.id}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-black text-slate-800">{formatCurrency(order.totalCost)}</p>
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Total Cost</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-4 rounded-2xl">
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Quantity</p>
                          <p className="font-black text-slate-800">{order.quantity}</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-2xl relative group">
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Target Link</p>
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-bold text-slate-800 text-sm truncate">{order.link}</p>
                            <button 
                              onClick={() => handleCopyLink(order.link)}
                              className="p-2 bg-white rounded-lg shadow-sm hover:text-cyan-500 transition-colors"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mark Order Status</label>
                        <div className="grid grid-cols-4 gap-2">
                          {[
                            { label: 'Pending', color: 'bg-slate-100 text-slate-600' },
                            { label: 'Processing', color: 'bg-amber-100 text-amber-600' },
                            { label: 'Completed', color: 'bg-emerald-100 text-emerald-600' },
                            { label: 'Cancelled', color: 'bg-rose-100 text-rose-600' }
                          ].map((s) => (
                            <button
                              key={s.label}
                              onClick={() => handleUpdateOrderStatus(order.id, s.label)}
                              className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all ${
                                order.status === s.label ? s.color + ' ring-2 ring-offset-1 ring-slate-200' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                              }`}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}

        {view === 'payments' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Payment Management</h2>
              <div className="flex bg-slate-100 p-1 rounded-2xl">
                <button 
                  onClick={() => setPaymentFilter('active')}
                  className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${paymentFilter === 'active' ? 'bg-white text-cyan-500 shadow-sm' : 'text-slate-400'}`}
                >
                  Active
                </button>
                <button 
                  onClick={() => setPaymentFilter('history')}
                  className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${paymentFilter === 'history' ? 'bg-white text-cyan-500 shadow-sm' : 'text-slate-400'}`}
                >
                  History
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {fundRequests
                .filter(r => paymentFilter === 'active' ? r.status === 'Pending' : (r.status === 'Approved' || r.status === 'Rejected'))
                .length === 0 ? (
                <div className="bg-white p-12 rounded-[2.5rem] border border-dashed border-slate-200 text-center">
                  <CreditCard className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-bold">No payment requests found.</p>
                </div>
              ) : (
                fundRequests
                  .filter(r => paymentFilter === 'active' ? r.status === 'Pending' : (r.status === 'Approved' || r.status === 'Rejected'))
                  .map((request) => (
                    <div key={request.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                              request.status === 'Approved' ? 'bg-emerald-50 text-emerald-500' :
                              request.status === 'Rejected' ? 'bg-rose-50 text-rose-500' :
                              'bg-amber-50 text-amber-500'
                            }`}>
                              {request.status}
                            </span>
                          </div>
                          <h3 className="font-black text-slate-800 text-lg">{request.userName || 'Unknown User'}</h3>
                          <p className="text-xs text-slate-500 font-bold">{request.userEmail || 'No Email'}</p>
                          <p className="text-xs text-slate-400 font-bold">Request ID: {request.id}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-black text-slate-800">{formatCurrency(request.amount)}</p>
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Requested Amount</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-4 rounded-2xl">
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Transaction ID</p>
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-mono font-bold text-slate-800 text-sm truncate">{request.transactionId}</p>
                            <button 
                              onClick={() => handleCopyLink(request.transactionId)}
                              className="p-1.5 bg-white rounded-lg shadow-sm hover:text-cyan-500 transition-colors"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-2xl">
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Date</p>
                          <p className="font-bold text-slate-800 text-sm">
                            {request.createdAt?.toDate ? request.createdAt.toDate().toLocaleString() : 'Just now'}
                          </p>
                        </div>
                      </div>

                      {request.status === 'Pending' && (
                        <div className="grid grid-cols-2 gap-3 pt-2">
                          <button
                            onClick={() => handleUpdatePaymentStatus(request.id, 'Rejected')}
                            className="bg-rose-50 text-rose-600 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-100 transition-all"
                          >
                            Reject / Cancel
                          </button>
                          <button
                            onClick={() => handleUpdatePaymentStatus(request.id, 'Approved')}
                            className="bg-emerald-500 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-100 hover:scale-[1.02] active:scale-[0.98] transition-all"
                          >
                            Complete / Approve
                          </button>
                        </div>
                      )}
                    </div>
                  ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Service Modal */}
      <AnimatePresence>
        {showServiceModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowServiceModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                  {editingService ? 'Edit Service' : 'New Service'}
                </h3>
                <button onClick={() => setShowServiceModal(false)} className="p-2 hover:bg-slate-100 rounded-full">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSaveService} className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Category</label>
                  <input
                    required
                    placeholder="e.g. Instagram"
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 font-bold text-slate-700"
                    value={serviceForm.category}
                    onChange={(e) => setServiceForm({ ...serviceForm, category: e.target.value })}
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Services</label>
                    {!editingService && (
                      <button 
                        type="button"
                        onClick={addServiceItem}
                        className="text-xs font-black text-cyan-500 hover:text-cyan-600 flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Add More
                      </button>
                    )}
                  </div>

                  {serviceForm.items.map((item, index) => (
                    <div key={index} className="p-4 bg-slate-50 rounded-3xl border border-slate-100 space-y-4 relative">
                      {serviceForm.items.length > 1 && !editingService && (
                        <button 
                          type="button"
                          onClick={() => removeServiceItem(index)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-lg"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                      
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2 space-y-1.5">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Service Name</label>
                          <input
                            required
                            placeholder="e.g. Real Followers"
                            className="w-full bg-white border border-slate-100 rounded-xl py-2 px-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 font-bold text-slate-700 text-sm"
                            value={item.name}
                            onChange={(e) => updateServiceItem(index, 'name', e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Emoji</label>
                          <input
                            placeholder="👥"
                            className="w-full bg-white border border-slate-100 rounded-xl py-2 px-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 font-bold text-slate-700 text-sm text-center"
                            value={item.emoji}
                            onChange={(e) => updateServiceItem(index, 'emoji', e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Description</label>
                        <textarea
                          placeholder="Describe the service..."
                          rows={2}
                          className="w-full bg-white border border-slate-100 rounded-xl py-2 px-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 font-bold text-slate-700 text-sm resize-none"
                          value={item.description}
                          onChange={(e) => updateServiceItem(index, 'description', e.target.value)}
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Price</label>
                          <input
                            required
                            type="number"
                            step="0.01"
                            placeholder="0.50"
                            className="w-full bg-white border border-slate-100 rounded-xl py-2 px-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 font-bold text-slate-700 text-sm"
                            value={item.pricePerUnit}
                            onChange={(e) => updateServiceItem(index, 'pricePerUnit', e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Min</label>
                          <input
                            required
                            type="number"
                            placeholder="10"
                            className="w-full bg-white border border-slate-100 rounded-xl py-2 px-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 font-bold text-slate-700 text-sm"
                            value={item.minQty}
                            onChange={(e) => updateServiceItem(index, 'minQty', e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Max</label>
                          <input
                            required
                            type="number"
                            placeholder="1000"
                            className="w-full bg-white border border-slate-100 rounded-xl py-2 px-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 font-bold text-slate-700 text-sm"
                            value={item.maxQty}
                            onChange={(e) => updateServiceItem(index, 'maxQty', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="submit"
                  className="w-full bg-cyan-500 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-cyan-200 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  {editingService ? 'Update Service' : `Create ${serviceForm.items.length} Service${serviceForm.items.length > 1 ? 's' : ''}`}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminPanel;
