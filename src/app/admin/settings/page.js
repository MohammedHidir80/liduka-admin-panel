'use client';

import { useEffect, useState } from 'react';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import useAuthStore from '@/store/authStore';
import { RefreshCw, Save, Wrench } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/utils/cn';

export default function SettingsPage() {
  const { user, adminData } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [maintenance, setMaintenance] = useState({
    mobile: false,
    web: false,
    message: "We're currently improving Liduka. Please check back shortly.",
  });

  const loadMaintenance = async () => {
    try {
      setLoading(true);

      const ref = doc(db, 'settings', 'maintenance');
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        const defaultData = {
          mobile: false,
          web: false,
          message:
            "We're currently improving Liduka. Please check back shortly.",
          createdAt: serverTimestamp(),
          createdBy: adminData?.uid || user?.uid || null,
        };

        await setDoc(ref, defaultData);

        setMaintenance({
          mobile: defaultData.mobile,
          web: defaultData.web,
          message: defaultData.message,
        });

        toast.success('Maintenance settings created');
      } else {
        setMaintenance({
          mobile: snap.data().mobile ?? false,
          web: snap.data().web ?? false,
          message:
            snap.data().message ??
            "We're currently improving Liduka. Please check back shortly.",
        });
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to load maintenance settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMaintenance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveMaintenance = async () => {
    try {
      setSaving(true);

      const ref = doc(db, 'settings', 'maintenance');

      await updateDoc(ref, {
        ...maintenance,
        updatedAt: serverTimestamp(),
        updatedBy: adminData?.uid || user?.uid || null,
      });

      toast.success('Maintenance settings updated');
    } catch (error) {
      console.error(error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="card p-10 text-center">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
        <p>Loading maintenance settings...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      <div className="flex items-center justify-between">

        <div>
          <h1 className="text-3xl font-bold">
            Maintenance Mode
          </h1>

          <p className="text-gray-500 mt-2">
            Enable or disable maintenance mode for the website and mobile app.
          </p>
        </div>

        <button
          onClick={loadMaintenance}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>

      </div>

      <div className="card p-8 space-y-8">

        {/* Website */}

        <div className="flex items-center justify-between">

          <div>

            <h2 className="font-semibold text-lg">
              Website
            </h2>

            <p className="text-sm text-gray-500">
              Put the web application into maintenance mode.
            </p>

          </div>

          <button
            onClick={() =>
              setMaintenance(prev => ({
                ...prev,
                web: !prev.web,
              }))
            }
            className={cn(
              "relative inline-flex h-7 w-12 items-center rounded-full transition-colors",
              maintenance.web
                ? "bg-red-600"
                : "bg-gray-300"
            )}
          >
            <span
              className={cn(
                "inline-block h-5 w-5 transform rounded-full bg-white transition-transform",
                maintenance.web
                  ? "translate-x-6"
                  : "translate-x-1"
              )}
            />
          </button>

        </div>

        {/* Mobile */}

        <div className="flex items-center justify-between">

          <div>

            <h2 className="font-semibold text-lg">
              Mobile App
            </h2>

            <p className="text-sm text-gray-500">
              Put the mobile application into maintenance mode.
            </p>

          </div>

          <button
            onClick={() =>
              setMaintenance(prev => ({
                ...prev,
                mobile: !prev.mobile,
              }))
            }
            className={cn(
              "relative inline-flex h-7 w-12 items-center rounded-full transition-colors",
              maintenance.mobile
                ? "bg-red-600"
                : "bg-gray-300"
            )}
          >
            <span
              className={cn(
                "inline-block h-5 w-5 transform rounded-full bg-white transition-transform",
                maintenance.mobile
                  ? "translate-x-6"
                  : "translate-x-1"
              )}
            />
          </button>

        </div>

        {/* Message */}

        <div>

          <label className="block text-sm font-medium mb-2">
            Maintenance Message
          </label>

          <textarea
            rows={5}
            value={maintenance.message}
            onChange={(e) =>
              setMaintenance(prev => ({
                ...prev,
                message: e.target.value,
              }))
            }
            className="input"
            placeholder="Maintenance message..."
          />

        </div>

        <button
          onClick={saveMaintenance}
          disabled={saving}
          className="btn-primary flex items-center gap-2"
        >
          <Save className="w-4 h-4" />

          {saving ? 'Saving...' : 'Save Changes'}

        </button>

      </div>

      <div className="card p-5 bg-yellow-50 border border-yellow-200">

        <div className="flex gap-3">

          <Wrench className="w-5 h-5 text-yellow-600 mt-1" />

          <div>

            <p className="font-semibold">
              Firestore Document
            </p>

            <p className="text-sm text-gray-600 mt-1">
              This page automatically creates:
            </p>

            <pre className="mt-3 text-sm bg-white p-3 rounded-lg overflow-auto">
              {`settings
└── maintenance
    ├── mobile: false
    ├── web: false
    ├── message: "We're currently improving Liduka..."
    ├── createdAt
    ├── createdBy
    ├── updatedAt
    └── updatedBy`}
            </pre>

          </div>

        </div>

      </div>

    </div>
  );
}