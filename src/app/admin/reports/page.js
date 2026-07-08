'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, []);

  async function loadReports() {
    try {
      const q = query(
        collection(db, 'reports'),
        where('status', '==', 'pending'),
        where('type', '==', 'product')
      );

      const snapshot = await getDocs(q);

      const data = await Promise.all(
        snapshot.docs.map(async (reportDoc) => {
          const report = reportDoc.data();

          let product = null;

          const productRef = doc(db, 'products', report.targetId);
          const productSnap = await getDoc(productRef);

          if (productSnap.exists()) {
            product = {
              id: productSnap.id,
              ...productSnap.data(),
            };
          }

          return {
            id: reportDoc.id,
            ...report,
            product,
          };
        })
      );

      setReports(data);
    } catch (err) {
      console.log(err);
    }

    setLoading(false);
  }

  async function hideProduct(report) {
    if (!report.product) return;

    try {
      await updateDoc(doc(db, 'products', report.product.id), {
        status: 'hidden',
      });

      await updateDoc(doc(db, 'reports', report.id), {
        status: 'resolved',
      });

      loadReports();
    } catch (err) {
      console.log(err);
    }
  }

  async function ignoreReport(reportId) {
    await updateDoc(doc(db, 'reports', reportId), {
      status: 'ignored',
    });

    loadReports();
  }

  if (loading) return <p className="p-6">Loading...</p>;

  return (
    <div className="p-6">

      <h1 className="text-3xl font-bold mb-6">
        Product Reports
      </h1>

      {reports.length === 0 && (
        <p>No pending reports.</p>
      )}

      {reports.map((report) => (
        <div
          key={report.id}
          className="border rounded-lg p-5 mb-5 shadow-sm"
        >
          <div className="flex gap-5">

            <img
              src={
                report.product?.images?.[0] ||
                '/placeholder.png'
              }
              className="w-28 h-28 object-cover rounded"
            />

            <div className="flex-1">

              <h2 className="font-bold text-xl">
                {report.product?.name || 'Deleted Product'}
              </h2>

              <p className="mt-2">
                <strong>Reason:</strong> {report.reason}
              </p>

              <p>
                <strong>Description:</strong>{' '}
                {report.description || '-'}
              </p>

              <p>
                <strong>Vendor:</strong>{' '}
                {report.targetOwnerId}
              </p>

              <div className="flex gap-3 mt-4">

                <button
                  onClick={() => hideProduct(report)}
                  className="bg-red-600 text-white px-4 py-2 rounded"
                >
                  Hide Product
                </button>

                <button
                  onClick={() => ignoreReport(report.id)}
                  className="bg-gray-600 text-white px-4 py-2 rounded"
                >
                  Ignore Report
                </button>

              </div>

            </div>

          </div>
        </div>
      ))}

    </div>
  );
}