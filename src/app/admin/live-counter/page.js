'use client';

import { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';

export default function LiveCounterPage() {
  const [userCount, setUserCount] = useState(null);
  const [orderCount, setOrderCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authChecking, setAuthChecking] = useState(true);
  const router = useRouter();

  // Unsubscribe functions
  const unsubUsers = useRef(null);
  const unsubOrders = useRef(null);

  // 1. Check authentication
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.push('/admin/login');
      } else {
        setAuthChecking(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  // 2. Real‑time listeners (only when authenticated)
  useEffect(() => {
    if (authChecking) return;

    // Listen to users collection
    const usersRef = collection(db, 'users');
    unsubUsers.current = onSnapshot(
      usersRef,
      (snapshot) => {
        setUserCount(snapshot.size);
        setLoading(false);
      },
      (error) => {
        console.error('Users listener error:', error);
        setLoading(false);
      }
    );

    // Listen to orders collection (bonus)
    const ordersRef = collection(db, 'orders');
    unsubOrders.current = onSnapshot(
      ordersRef,
      (snapshot) => {
        setOrderCount(snapshot.size);
      },
      (error) => {
        console.warn('Orders listener error (maybe no orders yet):', error.message);
        setOrderCount(0);
      }
    );

    return () => {
      if (unsubUsers.current) unsubUsers.current();
      if (unsubOrders.current) unsubOrders.current();
    };
  }, [authChecking]);

  

  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white">Checking authentication...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4">
      {/* Top bar with logout */}
      <div className="flex justify-between items-center max-w-6xl mx-auto mb-6">
        <h1 className="text-white text-xl font-semibold">Live Dashboard</h1>
        
      </div>

      {/* Main counter card */}
      <div className="flex items-center justify-center min-h-[calc(100vh-100px)]">
        <div className="max-w-4xl w-full">
          <div className="backdrop-blur-md bg-white/10 rounded-2xl shadow-2xl border border-white/20 p-8 md:p-12">
            {/* LIVE USERS */}
            <div className="text-center mb-12">
              <h2 className="text-gray-300 uppercase tracking-wider text-sm md:text-base font-semibold mb-2">
                LIVE USERS
              </h2>
              <div className="transition-all duration-200">
                {loading ? (
                  <div className="inline-block h-16 w-32 bg-white/20 rounded animate-pulse" />
                ) : (
                  <p className="text-7xl md:text-8xl lg:text-9xl font-black text-white tabular-nums">
                    {userCount?.toLocaleString() ?? 0}
                  </p>
                )}
              </div>
              <p className="text-gray-400 text-sm mt-4">
                Total registered users (real‑time)
              </p>
            </div>

            {/* Divider + LIVE ORDERS (optional) */}
            {orderCount !== null && (
              <>
                <div className="h-px bg-white/20 my-6" />
                <div className="text-center mt-8">
                  <h2 className="text-gray-300 uppercase tracking-wider text-sm md:text-base font-semibold mb-2">
                    LIVE ORDERS
                  </h2>
                  <p className="text-6xl md:text-7xl lg:text-8xl font-black text-white tabular-nums">
                    {orderCount.toLocaleString()}
                  </p>
                  <p className="text-gray-400 text-sm mt-4">
                    Total orders placed
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Live indicator */}
          <div className="flex justify-center mt-6">
            <div className="flex items-center gap-2 text-xs text-green-400 bg-green-400/10 px-3 py-1.5 rounded-full backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              Live updates active
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}