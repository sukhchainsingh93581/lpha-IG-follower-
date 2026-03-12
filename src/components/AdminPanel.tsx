import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, limit, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, getDoc, writeBatch, getDocs } from 'firebase/firestore';
import { db, rtdb } from '../firebase';
import { ref, onValue, remove, set } from 'firebase/database';
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
  RefreshCcw,
  ShoppingCart,
  CreditCard,
  Bell,
  Copy,
  Check,
  Pin,
  PinOff,
  ShieldAlert,
  ShieldCheck,
  UserMinus,
  ExternalLink,
  Phone,
  Mail,
  User
} from 'lucide-react';
import { formatCurrency } from '../utils';
import Swal from 'sweetalert2';

interface AdminPanelProps {
  onBack: () => void;
}

type AdminView = 'dashboard' | 'services' | 'app_management' | 'orders' | 'payments' | 'notifications' | 'user_management' | 'security_monitor';

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
  const [users, setUsers] = useState<any[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [adminNotifications, setAdminNotifications] = useState<any[]>([]);
  const [notificationForm, setNotificationForm] = useState({
    title: '',
    message: '',
    bannerUrl: '',
    targetType: 'all' as 'all' | 'specific',
    selectedUsers: [] as string[]
  });
  const [loading, setLoading] = useState(true);
  const [securityTracking, setSecurityTracking] = useState<any[]>([]);
  const [securitySearchQuery, setSecuritySearchQuery] = useState('');
  const [pinnedDevices, setPinnedDevices] = useState<Record<string, boolean>>({});
  const [signupLimitHours, setSignupLimitHours] = useState(24);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every second for the countdown timers
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-cleanup history after 12 hours
  useEffect(() => {
    const cleanupHistory = async () => {
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

      // Cleanup Orders
      const expiredOrders = allOrders.filter(o => {
        if (o.pinned) return false;
        if (o.status !== 'Completed' && o.status !== 'Cancelled') return false;
        const processedAt = o.processedAt?.toDate?.() || o.updatedAt?.toDate?.();
        return processedAt && processedAt < twelveHoursAgo;
      });

      for (const order of expiredOrders) {
        await deleteDoc(doc(db, 'orders', order.id));
      }

      // Cleanup Payments
      const expiredPayments = fundRequests.filter(r => {
        if (r.pinned) return false;
        if (r.status === 'Pending') return false;
        const processedAt = r.processedAt?.toDate?.() || r.updatedAt?.toDate?.();
        return processedAt && processedAt < twelveHoursAgo;
      });

      for (const request of expiredPayments) {
        await deleteDoc(doc(db, 'fundRequests', request.id));
      }
    };

    const interval = setInterval(cleanupHistory, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [allOrders, fundRequests]);
  
  // App Management State
  const [appConfig, setAppConfig] = useState({
    appName: 'InstaBoost',
    qrUrl: '',
    upiId: '',
    minPayment: 10,
    maxPayment: 10000,
    isMaintenanceMode: false,
    serviceMarkup: 0
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
      maxQty: '',
      api_service_id: ''
    }]
  });


  const addServiceItem = () => {
    setServiceForm(prev => ({
      ...prev,
      items: [...prev.items, { name: '', emoji: '', description: '', pricePerUnit: '', minQty: '', maxQty: '', api_service_id: '' }]
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
    // Real-time Users List
    const unsubscribeUsersList = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersData);
      setStats(prev => ({ ...prev, totalUsers: snapshot.size }));
    });

    // Real-time Notifications
    const unsubscribeNotifications = onSnapshot(query(collection(db, 'notifications'), orderBy('createdAt', 'desc')), (snapshot) => {
      const notificationsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAdminNotifications(notificationsData);
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

    // Real-time Security Tracking
    const securityRef = ref(rtdb, 'security_tracking/logs');
    const unsubscribeSecurity = onValue(securityRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const trackingList = Object.entries(data).map(([id, value]: [string, any]) => ({
          id,
          ...value
        })).sort((a, b) => b.createdAt - a.createdAt);
        setSecurityTracking(trackingList);
      } else {
        setSecurityTracking([]);
      }
    });

    // Real-time Pinned Devices
    const pinnedRef = ref(rtdb, 'pinned_devices');
    const unsubscribePinned = onValue(pinnedRef, (snapshot) => {
      if (snapshot.exists()) {
        setPinnedDevices(snapshot.val());
      } else {
        setPinnedDevices({});
      }
    });

    // Real-time Signup Limit Config
    const limitRef = ref(rtdb, 'settings/signup_limit_hours');
    const unsubscribeLimit = onValue(limitRef, (snapshot) => {
      if (snapshot.exists()) {
        setSignupLimitHours(snapshot.val());
      }
    });

      return () => {
        unsubscribeUsersList();
        unsubscribeNotifications();
        unsubscribeOrders();
        unsubscribeServices();
        unsubscribeConfig();
        unsubscribeAllOrders();
        unsubscribeRecent();
        unsubscribeFunds();
        unsubscribeSecurity();
        unsubscribePinned();
        unsubscribeLimit();
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
        processedAt: serverTimestamp(),
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
        processedAt: serverTimestamp(),
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

  const togglePin = async (type: 'orders' | 'fundRequests', id: string, currentPinned: boolean) => {
    try {
      await updateDoc(doc(db, type, id), {
        pinned: !currentPinned,
        updatedAt: serverTimestamp()
      });
      Swal.fire({ 
        icon: 'success', 
        title: !currentPinned ? 'Pinned' : 'Unpinned', 
        toast: true, 
        position: 'top-end', 
        showConfirmButton: false, 
        timer: 2000 
      });
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.message });
    }
  };

  const getCountdown = (processedAt: any) => {
    if (!processedAt) return null;
    const date = processedAt.toDate?.() || new Date(processedAt);
    const expiryDate = new Date(date.getTime() + 12 * 60 * 60 * 1000);
    const diff = expiryDate.getTime() - currentTime.getTime();

    if (diff <= 0) return "Expiring...";

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const handleSendNotification = async (data: { title: string, message: string, bannerUrl?: string, targetType: 'all' | 'specific', selectedUsers: string[] }) => {
    try {
      if (data.targetType === 'all') {
        await addDoc(collection(db, 'notifications'), {
          title: data.title,
          message: data.message,
          bannerUrl: data.bannerUrl || '',
          isGlobal: true,
          createdAt: serverTimestamp()
        });
      } else {
        for (const userId of data.selectedUsers) {
          await addDoc(collection(db, 'notifications'), {
            userId,
            title: data.title,
            message: data.message,
            bannerUrl: data.bannerUrl || '',
            isGlobal: false,
            createdAt: serverTimestamp()
          });
        }
      }
      Swal.fire({ icon: 'success', title: 'Notification Sent', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.message });
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
      Swal.fire({ icon: 'success', title: 'Notification Deleted', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.message });
    }
  };

  const handleUpdateUserBalance = async (userId: string, currentBalance: number) => {
    const { value: newBalance } = await Swal.fire({
      title: 'Update Balance',
      input: 'number',
      inputLabel: 'Enter new wallet balance',
      inputValue: currentBalance,
      showCancelButton: true,
      background: 'var(--card-bg)',
      color: 'var(--text-primary)',
      confirmButtonColor: 'var(--btn-bg)',
      inputValidator: (value) => {
        if (!value) return 'You need to enter a value!';
        return null;
      }
    });

    if (newBalance !== undefined) {
      try {
        await updateDoc(doc(db, 'users', userId), {
          walletBalance: Number(newBalance)
        });
        Swal.fire({ icon: 'success', title: 'Updated!', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
      } catch (error: any) {
        Swal.fire({ icon: 'error', title: 'Failed', text: error.message });
      }
    }
  };

  const handleToggleUserBlock = async (userId: string, isBlocked: boolean) => {
    const action = isBlocked ? 'Unblock' : 'Block';
    const result = await Swal.fire({
      title: `${action} User?`,
      text: `Are you sure you want to ${action.toLowerCase()} this user?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: isBlocked ? '#10b981' : '#f43f5e',
      confirmButtonText: `Yes, ${action}!`
    });

    if (result.isConfirmed) {
      try {
        await updateDoc(doc(db, 'users', userId), {
          isBlocked: !isBlocked
        });
        Swal.fire({ icon: 'success', title: `${action}ed!`, toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
      } catch (error: any) {
        Swal.fire({ icon: 'error', title: 'Failed', text: error.message });
      }
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const result = await Swal.fire({
      title: 'Delete User?',
      text: 'This action is permanent and cannot be undone!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f43f5e',
      confirmButtonText: 'Yes, Delete!'
    });

    if (result.isConfirmed) {
      try {
        await deleteDoc(doc(db, 'users', userId));
        // Also remove from bypass if exists
        await remove(ref(rtdb, `bypass_users/${userId}`));
        Swal.fire({ icon: 'success', title: 'Deleted!', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
      } catch (error: any) {
        Swal.fire({ icon: 'error', title: 'Failed', text: error.message });
      }
    }
  };

  const handleTogglePinDevice = async (deviceId: string, currentStatus: boolean) => {
    try {
      await set(ref(rtdb, `pinned_devices/${deviceId}`), !currentStatus);
      Swal.fire({
        icon: 'success',
        title: `Device ${!currentStatus ? 'Pinned' : 'Unpinned'}`,
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000,
        background: 'var(--card-bg)',
        color: 'var(--text-primary)'
      });
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.message });
    }
  };

  const handleDeleteTrackingRecord = async (recordId: string, deviceId?: string, ip?: string) => {
    const result = await Swal.fire({
      title: 'Delete Record?',
      text: "This will also reset the limit for this device/IP.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f43f5e',
      confirmButtonText: 'Yes, Delete!'
    });

    if (result.isConfirmed) {
      try {
        await remove(ref(rtdb, `security_tracking/logs/${recordId}`));
        if (deviceId) await remove(ref(rtdb, `security_tracking/last_device/${deviceId}`));
        if (ip) await remove(ref(rtdb, `security_tracking/last_ip/${ip.replace(/\./g, '_')}`));
        Swal.fire({ icon: 'success', title: 'Record Deleted', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
      } catch (error: any) {
        Swal.fire({ icon: 'error', title: 'Error', text: error.message });
      }
    }
  };

  const handleRefreshSecurity = () => {
    Swal.fire({
      icon: 'success',
      title: 'Security Data Refreshed',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 2000,
      background: 'var(--card-bg)',
      color: 'var(--text-primary)'
    });
  };

  const handleUpdateLimitHours = async () => {
    const { value: hours } = await Swal.fire({
      title: 'Signup Limit (Hours)',
      input: 'number',
      inputLabel: 'Enter hours (e.g. 24, 48, 72)',
      inputValue: signupLimitHours,
      showCancelButton: true,
      background: 'var(--card-bg)',
      color: 'var(--text-primary)',
      confirmButtonColor: 'var(--btn-bg)',
      inputValidator: (value) => {
        if (!value || parseInt(value) < 1) return 'Please enter a valid number of hours!';
        return null;
      }
    });

    if (hours) {
      try {
        await set(ref(rtdb, 'settings/signup_limit_hours'), parseInt(hours));
        Swal.fire({ icon: 'success', title: 'Limit Updated', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
      } catch (error: any) {
        Swal.fire({ icon: 'error', title: 'Error', text: error.message });
      }
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const configRef = doc(db, 'settings', 'app_config');
      const configSnap = await getDoc(configRef);
      const oldConfig = configSnap.exists() ? configSnap.data() : null;
      
      await updateDoc(configRef, {
        ...appConfig,
        updatedAt: serverTimestamp()
      });

      // If markup changed, update all service prices
      if (!oldConfig || oldConfig.serviceMarkup !== appConfig.serviceMarkup) {
        // Fetch fresh API prices to ensure we have the real base prices
        let apiPricesMap: Record<string, number> = {};
        try {
          const apiRes = await fetch('/api/services');
          if (apiRes.ok) {
            const apiServices = await apiRes.json();
            if (Array.isArray(apiServices)) {
              apiServices.forEach((s: any) => {
                apiPricesMap[s.service.toString()] = parseFloat(s.rate) / 1000;
              });
            }
          }
        } catch (apiErr) {
          console.error("Failed to fetch fresh API prices for markup update:", apiErr);
        }

        const servicesSnap = await getDocs(collection(db, 'services'));
        const serviceDocs = servicesSnap.docs;
        const markup = Number(appConfig.serviceMarkup) || 0;
        
        // Update in chunks of 400
        for (let i = 0; i < serviceDocs.length; i += 400) {
          const batch = writeBatch(db);
          const chunk = serviceDocs.slice(i, i + 400);
          
          chunk.forEach((doc) => {
            const data = doc.data();
            const apiId = data.api_service_id;
            let basePrice = (apiId && apiPricesMap[apiId]) || data.basePrice || data.pricePerUnit || 0;
            const newPrice = basePrice * (1 + markup / 100);
            
            batch.update(doc.ref, { 
              basePrice: basePrice, 
              pricePerUnit: Number(newPrice.toFixed(4)),
              updatedAt: serverTimestamp() 
            });
          });
          
          await batch.commit();
        }
        
        Swal.fire({ icon: 'success', title: 'Config & Prices Updated', text: `All services updated with ${appConfig.serviceMarkup}% markup. Old markup has been removed.`, toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
      } else {
        Swal.fire({ icon: 'success', title: 'Config Saved', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
      }
    } catch (error: any) {
      // If document doesn't exist, create it
      try {
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
          api_service_id: item.api_service_id || '',
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
          api_service_id: item.api_service_id || '',
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
        items: [{ name: '', emoji: '', description: '', pricePerUnit: '', minQty: '', maxQty: '', api_service_id: '' }] 
      });
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.message });
    }
  };


  const handleSyncServices = async () => {
    const result = await Swal.fire({
      title: 'Sync Services?',
      text: 'This will fetch all services from SMM API and add missing ones to Firebase.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Sync',
      showLoaderOnConfirm: true,
      preConfirm: async () => {
        try {
          const response = await fetch('/api/services');
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Server error: ${response.status}`);
          }
          const apiServices = await response.json();
          
          if (Array.isArray(apiServices)) {
            const existingApiIds = new Set(services.map(s => s.api_service_id));
            const newServices = apiServices.filter(s => !existingApiIds.has(s.service.toString()));
            
            if (newServices.length === 0) return 0;

            // Use batches for better performance (limit 500 per batch)
            const batchSize = 400;
            let addedCount = 0;

            for (let i = 0; i < newServices.length; i += batchSize) {
              const batch = writeBatch(db);
              const chunk = newServices.slice(i, i + batchSize);
              
              chunk.forEach(s => {
                const newDocRef = doc(collection(db, 'services'));
                const basePrice = parseFloat(s.rate) / 1000;
                const markup = Number(appConfig.serviceMarkup) || 0;
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
                  average_time: s.average_time || '',
                  enabled: true,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp()
                });
                addedCount++;
              });
              
              await batch.commit();
            }
            
            return addedCount;
          }
          throw new Error('Invalid API response: ' + JSON.stringify(apiServices));
        } catch (error: any) {
          Swal.showValidationMessage(`Sync failed: ${error.message}`);
        }
      },
      allowOutsideClick: () => !Swal.isLoading()
    });

    if (result.isConfirmed) {
      Swal.fire({ icon: 'success', title: 'Sync Complete', text: `${result.value} new services added.` });
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

  const handleDeleteAllServices = async () => {
    const result = await Swal.fire({
      title: 'Delete All Services & Categories?',
      text: 'This action is permanent and will remove everything from Service Management!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Yes, Delete All'
    });

    if (result.isConfirmed) {
      try {
        Swal.fire({
          title: 'Deleting...',
          text: 'Please wait while we clear all services.',
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          }
        });

        // Delete all services in chunks of 400
        const servicesSnap = await getDocs(collection(db, 'services'));
        const serviceDocs = servicesSnap.docs;
        for (let i = 0; i < serviceDocs.length; i += 400) {
          const batch = writeBatch(db);
          const chunk = serviceDocs.slice(i, i + 400);
          chunk.forEach(doc => batch.delete(doc.ref));
          await batch.commit();
        }

        // Delete all categories in chunks of 400
        const categoriesSnap = await getDocs(collection(db, 'categories'));
        const categoryDocs = categoriesSnap.docs;
        for (let i = 0; i < categoryDocs.length; i += 400) {
          const batch = writeBatch(db);
          const chunk = categoryDocs.slice(i, i + 400);
          chunk.forEach(doc => batch.delete(doc.ref));
          await batch.commit();
        }

        Swal.fire({ icon: 'success', title: 'All Services & Categories Deleted', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
      } catch (error: any) {
        Swal.fire({ icon: 'error', title: 'Error', text: error.message });
      }
    }
  };

  const handleIncreaseCharges = async () => {
    // Redundant - functionality moved to App Management markup
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
                <Layers className="w-5 h-5" />
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
              <button
                onClick={() => { setView('notifications'); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl font-bold transition-all ${
                  view === 'notifications' ? 'bg-cyan-50 text-cyan-600' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <Bell className="w-5 h-5" />
                Notifications
              </button>
              <button
                onClick={() => { setView('user_management'); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl font-bold transition-all ${
                  view === 'user_management' ? 'bg-cyan-50 text-cyan-600' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <Users className="w-5 h-5" />
                User Management
              </button>

              <button
                onClick={() => { setView('security_monitor'); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl font-bold transition-all ${
                  view === 'security_monitor' ? 'bg-cyan-50 text-cyan-600' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <ShieldAlert className="w-5 h-5" />
                Security Monitor
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
               view === 'payments' ? 'Payment Management' :
               view === 'notifications' ? 'Notifications' :
               'User Management'}
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
            {/* Category Management View */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Manage Services</h2>
                <div className="flex gap-2">
                  <button 
                    onClick={handleSyncServices}
                    className="bg-slate-100 text-slate-600 p-3 rounded-2xl flex items-center gap-2 font-bold hover:bg-slate-200 transition-colors"
                  >
                    <RefreshCcw className="w-5 h-5" />
                    Sync
                  </button>
                  <button 
                    onClick={() => { 
                      setEditingService(null); 
                      setServiceForm({ 
                        category: '', 
                        items: [{ name: '', emoji: '', description: '', pricePerUnit: '', minQty: '', maxQty: '', api_service_id: '' }] 
                      }); 
                      setShowServiceModal(true); 
                    }}
                    className="bg-cyan-500 text-white p-3 rounded-2xl flex items-center gap-2 font-bold shadow-lg shadow-cyan-200 hover:scale-105 transition-transform"
                  >
                    <Plus className="w-5 h-5" />
                    New Service
                  </button>
                </div>
              </div>

              {/* Bulk Actions Bar */}
              <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
                <button 
                  onClick={handleDeleteAllServices}
                  className="whitespace-nowrap bg-rose-50 text-rose-600 px-4 py-2.5 rounded-xl flex items-center gap-2 font-black text-[10px] uppercase tracking-widest border border-rose-100 hover:bg-rose-100 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete All Services
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {services.length === 0 ? (
                <div className="bg-white p-12 rounded-[2.5rem] border border-dashed border-slate-200 text-center">
                  <Layers className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-bold">No services created yet.</p>
                </div>
              ) : (
                Object.entries(
                  services.reduce((acc, service) => {
                    if (!acc[service.category]) acc[service.category] = [];
                    acc[service.category].push(service);
                    return acc;
                  }, {} as Record<string, any[]>)
                ).map(([category, categoryServices]) => (
                  <div key={category} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="bg-slate-50/50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-cyan-500 flex items-center justify-center">
                          <Layers className="w-4 h-4 text-white" />
                        </div>
                        <h3 className="font-black text-slate-800 uppercase tracking-widest text-sm">{category}</h3>
                      </div>
                      <span className="text-[10px] font-black text-slate-400 bg-white px-2 py-1 rounded-full border border-slate-100">
                        {(categoryServices as any[]).length} Services
                      </span>
                    </div>
                    <div className="p-4 space-y-4">
                      {(categoryServices as any[]).map((service) => (
                        <div key={service.id} className="bg-slate-50/30 p-4 rounded-3xl border border-slate-100/50 space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="space-y-0.5">
                              <h4 className="font-black text-slate-800">{service.name}</h4>
                              <p className="text-[10px] text-slate-400 font-medium line-clamp-1">{service.description}</p>
                            </div>
                            <div className="flex gap-1.5">
                              <button onClick={() => openEditModal(service)} className="p-2 bg-white text-slate-400 hover:text-cyan-500 rounded-xl transition-colors border border-slate-100 shadow-sm">
                                <Edit className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDeleteService(service.id)} className="p-2 bg-white text-slate-400 hover:text-rose-500 rounded-xl transition-colors border border-slate-100 shadow-sm">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-white p-2 rounded-xl text-center border border-slate-100">
                              <p className="text-[8px] text-slate-400 font-bold uppercase">Price</p>
                              <p className="text-[10px] font-black text-slate-700">{formatCurrency(service.pricePerUnit)}</p>
                            </div>
                            <div className="bg-white p-2 rounded-xl text-center border border-slate-100">
                              <p className="text-[8px] text-slate-400 font-bold uppercase">Min</p>
                              <p className="text-[10px] font-black text-slate-700">{service.minQty}</p>
                            </div>
                            <div className="bg-white p-2 rounded-xl text-center border border-slate-100">
                              <p className="text-[8px] text-slate-400 font-bold uppercase">Max</p>
                              <p className="text-[10px] font-black text-slate-700">{service.maxQty}</p>
                            </div>
                          </div>
                        </div>
                      ))}
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
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Service Markup (%)</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 20"
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 font-bold text-slate-700"
                  value={appConfig.serviceMarkup}
                  onChange={(e) => setAppConfig({ ...appConfig, serviceMarkup: parseInt(e.target.value) || 0 })}
                />
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest ml-1">This percentage will be added to the base SMM API price.</p>
              </div>

              <div className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <div className="space-y-1">
                  <h3 className="font-black text-slate-800">Maintenance Mode</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    {appConfig.isMaintenanceMode ? 'App is currently locked' : 'App is currently active'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAppConfig({ ...appConfig, isMaintenanceMode: !appConfig.isMaintenanceMode })}
                  className={`w-14 h-8 rounded-full relative transition-colors ${appConfig.isMaintenanceMode ? 'bg-rose-500' : 'bg-slate-200'}`}
                >
                  <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${appConfig.isMaintenanceMode ? 'left-7' : 'left-1'}`} />
                </button>
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Min Payment (₹)</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 10"
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 font-bold text-slate-700"
                    value={appConfig.minPayment}
                    onChange={(e) => setAppConfig({ ...appConfig, minPayment: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Max Payment (₹)</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 10000"
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 font-bold text-slate-700"
                    value={appConfig.maxPayment}
                    onChange={(e) => setAppConfig({ ...appConfig, maxPayment: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">SMM API Settings</h3>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">SMM API URL</label>
                  <input
                    placeholder="https://app.smmowl.com/api/v2"
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 font-bold text-slate-700"
                    value={appConfig.smmApiUrl || ''}
                    onChange={(e) => setAppConfig({ ...appConfig, smmApiUrl: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">SMM API Key</label>
                  <input
                    type="password"
                    placeholder="Enter your SMM API Key"
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 font-bold text-slate-700"
                    value={appConfig.smmApiKey || ''}
                    onChange={(e) => setAppConfig({ ...appConfig, smmApiKey: e.target.value })}
                  />
                </div>
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
                    return (
                      o.status.toLowerCase().includes(search) || 
                      o.id.toLowerCase().includes(search) ||
                      (o.userName && o.userName.toLowerCase().includes(search)) ||
                      (o.userEmail && o.userEmail.toLowerCase().includes(search))
                    );
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
                      return (
                        o.status.toLowerCase().includes(search) || 
                        o.id.toLowerCase().includes(search) ||
                        (o.userName && o.userName.toLowerCase().includes(search)) ||
                        (o.userEmail && o.userEmail.toLowerCase().includes(search))
                      );
                    }
                    if (orderFilter === 'active') {
                      return o.status === 'Pending' || o.status === 'Processing';
                    }
                    return o.status === 'Completed' || o.status === 'Cancelled';
                  })
                  .map((order) => (
                    <div key={order.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="bg-cyan-50 text-cyan-600 text-[10px] font-black px-2 py-0.5 rounded-full uppercase shrink-0">
                              {order.category}
                            </span>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase shrink-0 ${
                              order.status === 'Completed' ? 'bg-emerald-50 text-emerald-500' :
                              order.status === 'Cancelled' ? 'bg-rose-50 text-rose-500' :
                              order.status === 'Processing' ? 'bg-amber-50 text-amber-500' :
                              'bg-slate-50 text-slate-500'
                            }`}>
                              {order.status}
                            </span>
                            {orderFilter === 'history' && (
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                                  <Clock className="w-3 h-3" />
                                  {order.pinned ? 'Pinned' : getCountdown(order.processedAt)}
                                </span>
                                <button 
                                  onClick={() => togglePin('orders', order.id, !!order.pinned)}
                                  className={`p-1 rounded-lg transition-all shrink-0 ${order.pinned ? 'bg-cyan-500 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                                >
                                  {order.pinned ? <Pin className="w-3 h-3" /> : <PinOff className="w-3 h-3" />}
                                </button>
                              </div>
                            )}
                          </div>
                          <h3 className="font-black text-slate-800 text-lg truncate">{order.serviceName}</h3>
                          <div className="flex flex-col gap-0.5">
                            <p className="text-xs text-slate-400 font-bold truncate">Order ID: {order.id}</p>
                            {order.userName && (
                              <p className="text-xs text-cyan-600 font-black truncate">User: {order.userName} ({order.userEmail})</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-4">
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
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase shrink-0 ${
                              request.status === 'Approved' ? 'bg-emerald-50 text-emerald-500' :
                              request.status === 'Rejected' ? 'bg-rose-50 text-rose-500' :
                              'bg-amber-50 text-amber-500'
                            }`}>
                              {request.status}
                            </span>
                            {paymentFilter === 'history' && (
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                                  <Clock className="w-3 h-3" />
                                  {request.pinned ? 'Pinned' : getCountdown(request.processedAt)}
                                </span>
                                <button 
                                  onClick={() => togglePin('fundRequests', request.id, !!request.pinned)}
                                  className={`p-1 rounded-lg transition-all shrink-0 ${request.pinned ? 'bg-cyan-500 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                                >
                                  {request.pinned ? <Pin className="w-3 h-3" /> : <PinOff className="w-3 h-3" />}
                                </button>
                              </div>
                            )}
                          </div>
                          <h3 className="font-black text-slate-800 text-lg truncate">{request.userName || 'Unknown User'}</h3>
                          <p className="text-xs text-slate-500 font-bold truncate">{request.userEmail || 'No Email'}</p>
                          <p className="text-xs text-slate-400 font-bold truncate">Request ID: {request.id}</p>
                        </div>
                        <div className="text-right shrink-0 ml-4">
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

        {view === 'notifications' && (
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Send Notification</h2>
              
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Banner Image URL (Optional)</label>
                  <input
                    type="text"
                    placeholder="https://example.com/image.jpg"
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 font-bold text-slate-700"
                    value={notificationForm.bannerUrl}
                    onChange={(e) => setNotificationForm({ ...notificationForm, bannerUrl: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Title</label>
                  <input
                    type="text"
                    placeholder="Notification Title"
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 font-bold text-slate-700"
                    value={notificationForm.title}
                    onChange={(e) => setNotificationForm({ ...notificationForm, title: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Message</label>
                  <textarea
                    rows={3}
                    placeholder="Type your message here..."
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 font-bold text-slate-700 resize-none"
                    value={notificationForm.message}
                    onChange={(e) => setNotificationForm({ ...notificationForm, message: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Target Audience</label>
                  <div className="flex bg-slate-100 p-1 rounded-2xl">
                    <button 
                      onClick={() => setNotificationForm({ ...notificationForm, targetType: 'all' })}
                      className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${notificationForm.targetType === 'all' ? 'bg-white text-cyan-500 shadow-sm' : 'text-slate-400'}`}
                    >
                      All Users
                    </button>
                    <button 
                      onClick={() => setNotificationForm({ ...notificationForm, targetType: 'specific' })}
                      className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${notificationForm.targetType === 'specific' ? 'bg-white text-cyan-500 shadow-sm' : 'text-slate-400'}`}
                    >
                      Specific Users
                    </button>
                  </div>
                </div>

                {notificationForm.targetType === 'specific' && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Users ({notificationForm.selectedUsers.length} selected)</label>
                    <div className="max-h-40 overflow-y-auto bg-slate-50 rounded-2xl p-2 space-y-1 border border-slate-100">
                      {users.map(u => (
                        <label key={u.id} className="flex items-center gap-3 p-2 hover:bg-white rounded-xl cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded text-cyan-500 focus:ring-cyan-500/20"
                            checked={notificationForm.selectedUsers.includes(u.id)}
                            onChange={(e) => {
                              const selected = e.target.checked 
                                ? [...notificationForm.selectedUsers, u.id]
                                : notificationForm.selectedUsers.filter(id => id !== u.id);
                              setNotificationForm({ ...notificationForm, selectedUsers: selected });
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-700 truncate">{u.name || 'User'}</p>
                            <p className="text-[10px] text-slate-400 font-bold truncate">{u.email}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => {
                    if (!notificationForm.title || !notificationForm.message) {
                      return Swal.fire({ icon: 'error', title: 'Missing Info', text: 'Title and Message are required.' });
                    }
                    if (notificationForm.targetType === 'specific' && notificationForm.selectedUsers.length === 0) {
                      return Swal.fire({ icon: 'error', title: 'No Users Selected', text: 'Please select at least one user.' });
                    }
                    handleSendNotification(notificationForm);
                    setNotificationForm({ title: '', message: '', bannerUrl: '', targetType: 'all', selectedUsers: [] });
                  }}
                  className="w-full bg-cyan-500 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-cyan-100 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  Send Notification
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-black text-slate-800 ml-1">Recent Notifications</h3>
              {adminNotifications.length === 0 ? (
                <div className="bg-white p-12 rounded-[2.5rem] border border-dashed border-slate-200 text-center">
                  <Bell className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-bold">No notifications sent yet.</p>
                </div>
              ) : (
                adminNotifications.map(n => (
                  <div key={n.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${n.isGlobal ? 'bg-cyan-50 text-cyan-500' : 'bg-slate-50 text-slate-500'}`}>
                            {n.isGlobal ? 'Global' : 'Specific'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold">
                            {n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString() : 'Just now'}
                          </span>
                        </div>
                        <h4 className="font-black text-slate-800">{n.title}</h4>
                        <p className="text-sm text-slate-500 font-medium line-clamp-2">{n.message}</p>
                      </div>
                      <button 
                        onClick={() => handleDeleteNotification(n.id)}
                        className="p-2 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {n.bannerUrl && (
                      <div className="rounded-xl overflow-hidden border border-slate-100">
                        <img src={n.bannerUrl} alt="Banner" className="w-full h-auto block" referrerPolicy="no-referrer" />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {view === 'user_management' && (
          <div className="space-y-6">
            <div className="flex flex-col gap-4">
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">User Management</h2>
              
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-100 rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 font-bold text-slate-700 text-sm shadow-sm"
                />
              </div>
            </div>

            <div className="space-y-4">
              {users
                .filter(u => {
                  const search = userSearchQuery.toLowerCase();
                  return (u.name || '').toLowerCase().includes(search) || (u.email || '').toLowerCase().includes(search);
                })
                .length === 0 ? (
                <div className="bg-white p-12 rounded-[2.5rem] border border-dashed border-slate-200 text-center">
                  <Users className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-bold">No users found.</p>
                </div>
              ) : (
                users
                  .filter(u => {
                    const search = userSearchQuery.toLowerCase();
                    return (u.name || '').toLowerCase().includes(search) || (u.email || '').toLowerCase().includes(search);
                  })
                  .map((u) => (
                    <div key={u.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                          <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100">
                            <Users className="w-6 h-6 text-slate-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-black text-slate-800 text-lg truncate">{u.name || 'User'}</h3>
                            <div className="space-y-0.5">
                              <p className="text-xs text-slate-500 font-bold flex items-center gap-1.5">
                                <Mail className="w-3 h-3 opacity-40 shrink-0" />
                                <span className="truncate">{u.email}</span>
                              </p>
                              {u.phone && (
                                <p className="text-xs text-slate-500 font-bold flex items-center gap-1.5">
                                  <Phone className="w-3 h-3 opacity-40 shrink-0" />
                                  <span className="truncate">{u.phone}</span>
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${u.isBlocked ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'}`}>
                                {u.isBlocked ? 'Blocked' : 'Active'}
                              </span>
                              <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">
                                ID: {u.id.slice(0, 8)}...
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-4">
                          <p className="text-xl font-black text-slate-800">{formatCurrency(u.walletBalance || 0)}</p>
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Wallet Balance</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 pt-2">
                        <button
                          onClick={() => handleUpdateUserBalance(u.id, u.walletBalance || 0)}
                          className="flex flex-col items-center justify-center gap-1 p-3 bg-slate-50 text-slate-600 rounded-2xl hover:bg-slate-100 transition-all group"
                        >
                          <Edit className="w-4 h-4 group-hover:text-cyan-500" />
                          <span className="text-[10px] font-black uppercase">Edit</span>
                        </button>
                        <button
                          onClick={() => handleToggleUserBlock(u.id, !!u.isBlocked)}
                          className={`flex flex-col items-center justify-center gap-1 p-3 rounded-2xl transition-all group ${u.isBlocked ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-rose-50 text-rose-600 hover:bg-rose-100'}`}
                        >
                          {u.isBlocked ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                          <span className="text-[10px] font-black uppercase">{u.isBlocked ? 'Unblock' : 'Block'}</span>
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          className="flex flex-col items-center justify-center gap-1 p-3 bg-slate-50 text-slate-600 rounded-2xl hover:bg-rose-50 hover:text-rose-600 transition-all group"
                        >
                          <UserMinus className="w-4 h-4" />
                          <span className="text-[10px] font-black uppercase">Delete</span>
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}

        {view === 'security_monitor' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Security Monitor</h2>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <button
                  onClick={handleUpdateLimitHours}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-cyan-50 text-cyan-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-cyan-100 transition-all"
                >
                  <Clock className="w-4 h-4" />
                  Limit: {signupLimitHours}h
                </button>
                <button
                  onClick={handleRefreshSecurity}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-100 transition-all"
                >
                  <RefreshCcw className="w-4 h-4" />
                  Refresh
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="w-5 h-5 text-slate-400 group-focus-within:text-cyan-500 transition-colors" />
              </div>
              <input
                type="text"
                placeholder="Search by Name, Email, or Min Accounts (e.g. '2' for 3+ accounts)..."
                value={securitySearchQuery}
                onChange={(e) => setSecuritySearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-[1.5rem] focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all font-bold text-slate-600 placeholder:text-slate-300 shadow-sm"
              />
            </div>

            <div className="space-y-4">
              {(() => {
                const filtered = securityTracking.filter(record => {
                  if (!securitySearchQuery) return true;
                  const query = securitySearchQuery.toLowerCase().trim();
                  
                  // Check if query is a number
                  const queryNum = parseInt(query);
                  if (!isNaN(queryNum) && query.match(/^\d+$/)) {
                    return (record.count || 0) > queryNum;
                  }
                  
                  // Search in accounts
                  const hasMatchingAccount = record.accounts?.some((acc: any) => {
                    if (typeof acc === 'object') {
                      return (
                        acc.name?.toLowerCase().includes(query) ||
                        acc.email?.toLowerCase().includes(query) ||
                        acc.uid?.toLowerCase().includes(query)
                      );
                    }
                    return acc.toString().toLowerCase().includes(query);
                  });
                  
                  return (
                    hasMatchingAccount ||
                    record.deviceId?.toLowerCase().includes(query) ||
                    record.ip?.toLowerCase().includes(query)
                  );
                });

                if (filtered.length === 0) {
                  return (
                    <div className="bg-white p-12 rounded-[2.5rem] border border-dashed border-slate-200 text-center">
                      <ShieldCheck className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                      <p className="text-slate-400 font-bold">No matching records found.</p>
                    </div>
                  );
                }

                return filtered.map((record) => (
                  <div key={record.id} className="bg-white p-5 sm:p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="space-y-2 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[9px] font-black text-cyan-500 bg-cyan-50 px-2 py-0.5 rounded-full uppercase tracking-widest shrink-0">
                            Device ID
                          </span>
                          <p className="font-mono text-[10px] sm:text-xs text-slate-600 truncate bg-slate-50 px-2 py-1 rounded-lg flex-1">{record.deviceId}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[9px] font-black text-purple-500 bg-purple-50 px-2 py-0.5 rounded-full uppercase tracking-widest shrink-0">
                            IP Address
                          </span>
                          <p className="font-mono text-[10px] sm:text-xs text-slate-600 truncate bg-slate-50 px-2 py-1 rounded-lg flex-1">{record.ip}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-start bg-slate-50 p-1 rounded-2xl shrink-0">
                        <button
                          onClick={() => handleTogglePinDevice(record.deviceId, !!pinnedDevices[record.deviceId])}
                          className={`p-2.5 rounded-xl transition-all ${pinnedDevices[record.deviceId] ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-200' : 'text-slate-400 hover:bg-white hover:text-cyan-500'}`}
                          title={pinnedDevices[record.deviceId] ? 'Unpin Device' : 'Pin Device'}
                        >
                          <Pin className={`w-4 h-4 sm:w-5 sm:h-5 ${pinnedDevices[record.deviceId] ? 'fill-current' : ''}`} />
                        </button>
                        <button
                          onClick={() => handleDeleteTrackingRecord(record.id, record.deviceId, record.ip)}
                          className="p-2.5 rounded-xl text-slate-400 hover:bg-white hover:text-rose-500 transition-all"
                          title="Delete Record"
                        >
                          <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="bg-slate-50 p-4 rounded-2xl">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Accounts ({record.count || 1})</p>
                          {record.count > 1 && <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 px-1.5 rounded">Multiple</span>}
                        </div>
                        <p className="font-bold text-slate-800 text-xs truncate">
                          {(() => {
                            const lastAcc = record.accounts && record.accounts.length > 0 
                              ? record.accounts[record.accounts.length - 1] 
                              : record.createdAccount;
                            
                            if (!lastAcc) return 'N/A';
                            if (typeof lastAcc === 'object') return lastAcc.name || lastAcc.uid;
                            return lastAcc;
                          })()}
                        </p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl">
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Last Signup</p>
                        <p className="font-bold text-slate-800 text-xs">
                          {new Date(record.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    
                    {record.accounts && record.accounts.length > 0 && (
                      <div className="pt-2 border-t border-slate-100">
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">All Accounts on this Device</p>
                        <div className="space-y-2">
                          {record.accounts.map((acc: any, idx: number) => {
                            const isObject = typeof acc === 'object';
                            const uid = isObject ? acc.uid : acc;
                            return (
                              <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[9px] font-mono text-slate-400">UID: {uid.slice(0, 10)}...</span>
                                  {isObject && acc.timestamp && (
                                    <span className="text-[9px] text-slate-400">{new Date(acc.timestamp).toLocaleDateString()}</span>
                                  )}
                                </div>
                                {isObject ? (
                                  <div className="grid grid-cols-1 gap-1">
                                    <div className="flex items-center gap-2">
                                      <User className="w-3 h-3 text-cyan-500" />
                                      <p className="text-xs font-bold text-slate-700">{acc.name}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Mail className="w-3 h-3 text-purple-500" />
                                      <p className="text-xs text-slate-600">{acc.email}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Phone className="w-3 h-3 text-emerald-500" />
                                      <p className="text-xs text-slate-600">{acc.phone}</p>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-xs text-slate-600 italic">Old record - no details available</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Category Modal */}
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
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">API ID</label>
                          <input
                            placeholder="e.g. 123"
                            className="w-full bg-white border border-slate-100 rounded-xl py-2 px-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 font-bold text-slate-700 text-sm"
                            value={item.api_service_id}
                            onChange={(e) => updateServiceItem(index, 'api_service_id', e.target.value)}
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
