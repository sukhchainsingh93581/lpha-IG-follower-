import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency, formatDate } from '../utils';
import { motion, AnimatePresence } from 'motion/react';
import { Wallet, ArrowUpRight, CreditCard, History, X, QrCode, Send, Loader2, Info, Copy, Check } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, doc } from 'firebase/firestore';
import Swal from 'sweetalert2';

const WalletPage = () => {
  const { user, userData } = useAuth();
  const [isAddingFunds, setIsAddingFunds] = useState(false);
  const [amount, setAmount] = useState<number | ''>('');
  const [transactionId, setTransactionId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const [appConfig, setAppConfig] = useState({ qrUrl: '', upiId: '' });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const unsubConfig = onSnapshot(doc(db, 'settings', 'app_config'), (doc) => {
      if (doc.exists()) {
        setAppConfig(doc.data() as any);
      }
    });
    return () => unsubConfig();
  }, []);

  const handleCopyUPI = () => {
    if (!appConfig.upiId) return;
    navigator.clipboard.writeText(appConfig.upiId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'fundRequests'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requestsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRequests(requestsData);
    });

    return () => unsubscribe();
  }, [user]);

  const handleAddFunds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !amount || !transactionId.trim()) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'fundRequests'), {
        userId: user.uid,
        userName: userData?.name || 'User',
        userEmail: user.email || '',
        amount: Number(amount),
        transactionId: transactionId.trim(),
        status: 'Pending',
        createdAt: serverTimestamp()
      });

      Swal.fire({
        icon: 'success',
        title: 'Request Submitted',
        text: 'Your payment verification request has been sent to the admin.',
        background: 'var(--card-bg)',
        color: 'var(--text-primary)',
        confirmButtonColor: 'var(--btn-bg)'
      });

      setIsAddingFunds(false);
      setAmount('');
      setTransactionId('');
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Request Failed',
        text: error.message,
        background: 'var(--card-bg)',
        color: 'var(--text-primary)'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="mb-8">
        <h2 className="text-sm font-medium text-white/60 uppercase tracking-widest mb-1">Manage Your</h2>
        <h1 className="text-3xl font-bold">Digital Wallet</h1>
      </header>

      {/* Premium Wallet Card */}
      <motion.div
        whileHover={{ scale: 1.02 }}
        className="relative h-56 rounded-[2.5rem] p-8 overflow-hidden premium-shadow group"
        style={{ background: 'var(--bg-gradient)' }}
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl group-hover:bg-white/20 transition-all duration-700" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/20 rounded-full -ml-10 -mb-10 blur-2xl" />
        
        <div className="relative z-10 h-full flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <CreditCard className="w-10 h-10 text-white/80" />
            <div className="text-right">
              <p className="text-xs text-white/60 uppercase tracking-widest mb-1">Wallet Balance</p>
              <h2 className="text-4xl font-bold">{formatCurrency(userData?.walletBalance || 0)}</h2>
            </div>
          </div>
          
          <div className="flex gap-4">
            <button 
              onClick={() => setIsAddingFunds(true)}
              className="w-full bg-white/20 backdrop-blur-md py-4 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm hover:bg-white/30 transition-colors"
            >
              <ArrowUpRight className="w-5 h-5" />
              Add Funds
            </button>
          </div>
        </div>
      </motion.div>

      {/* Fund Requests / History */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <History className="w-5 h-5 text-white/60" />
          <h3 className="font-bold text-lg">Payment History</h3>
        </div>

        <div className="grid gap-3">
          {requests.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center">
              <p className="text-white/40 text-sm italic">No payment requests found.</p>
            </div>
          ) : (
            requests.map((req) => (
              <div key={req.id} className="glass rounded-2xl p-4 flex items-center justify-between border border-white/5">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    req.status === 'Approved' ? 'bg-emerald-400/10 text-emerald-400' : 
                    req.status === 'Rejected' ? 'bg-rose-400/10 text-rose-400' : 'bg-yellow-400/10 text-yellow-400'
                  }`}>
                    {req.status === 'Approved' ? <ArrowUpRight className="w-5 h-5" /> : <Info className="w-5 h-5" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">₹{req.amount} - {req.status}</h4>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest">ID: {req.transactionId}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-white/40 uppercase tracking-widest">{formatDate(req.createdAt)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Funds Modal */}
      <AnimatePresence>
        {isAddingFunds && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-md glass rounded-[2.5rem] p-8 relative overflow-y-auto max-h-[90vh]"
            >
              <button
                onClick={() => setIsAddingFunds(false)}
                className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold mb-2">Add Funds</h2>
                <p className="text-white/50 text-sm">Scan QR and pay, then enter details below</p>
              </div>

              {/* QR Code Section */}
              <div className="flex flex-col items-center mb-8">
                <div className="bg-white p-4 rounded-3xl mb-4">
                  {appConfig.qrUrl ? (
                    <img 
                      src={appConfig.qrUrl} 
                      alt="Payment QR" 
                      className="w-48 h-48 object-contain"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-48 h-48 bg-slate-100 flex items-center justify-center rounded-2xl">
                      <QrCode className="w-12 h-12 text-slate-300" />
                    </div>
                  )}
                </div>
                
                {appConfig.upiId && (
                  <div className="w-full mb-6">
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2 text-center">Or Pay via UPI ID</p>
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 p-3 rounded-2xl">
                      <div className="flex-1 truncate font-mono text-sm text-white/80 px-2">
                        {appConfig.upiId}
                      </div>
                      <button
                        onClick={handleCopyUPI}
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors flex items-center gap-2 text-xs font-bold"
                      >
                        {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 text-white/60 text-xs bg-white/5 px-4 py-2 rounded-full">
                  <QrCode className="w-4 h-4" />
                  <span>Scan to Pay via UPI</span>
                </div>
              </div>

              {/* Verification Form */}
              <form onSubmit={handleAddFunds} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-1">Amount Paid (₹)</label>
                  <input
                    type="number"
                    placeholder="Enter amount you paid"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-white/10 border border-white/20 rounded-2xl py-4 px-5 focus:outline-none focus:ring-2 ring-white/20 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-1">Transaction ID (Tnx ID)</label>
                  <input
                    type="text"
                    placeholder="Enter payment reference ID"
                    required
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-2xl py-4 px-5 focus:outline-none focus:ring-2 ring-white/20 transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || !amount || !transactionId}
                  className="w-full bg-white text-black font-black py-5 rounded-2xl flex items-center justify-center gap-3 hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-30 premium-shadow"
                  style={{ backgroundColor: 'var(--btn-bg)', color: 'var(--btn-text)' }}
                >
                  {submitting ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      SUBMIT FOR VERIFICATION
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WalletPage;
