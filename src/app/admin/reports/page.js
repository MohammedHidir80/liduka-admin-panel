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
import {
    AlertTriangle,
    Eye,
    EyeOff,
    XCircle,
    CheckCircle,
    Clock,
    ShoppingBag,
    User,
    FileText,
    AlertCircle,
} from 'lucide-react';

export default function ReportsPage() {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);

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
        setActionLoading(report.id);

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
        } finally {
            setActionLoading(null);
        }
    }

    async function ignoreReport(reportId) {
        setActionLoading(reportId);

        await updateDoc(doc(db, 'reports', reportId), {
            status: 'ignored',
        });

        loadReports();
        setActionLoading(null);
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6 md:p-8">
                <div className="max-w-5xl mx-auto">
                    <div className="animate-pulse">
                        <div className="h-10 w-64 bg-slate-200 dark:bg-slate-700 rounded-lg mb-8"></div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                            {[1, 2, 3].map((i) => (
                                <div
                                    key={i}
                                    className="h-24 bg-slate-200 dark:bg-slate-700 rounded-xl"
                                ></div>
                            ))}
                        </div>
                        {[1, 2].map((i) => (
                            <div
                                key={i}
                                className="h-48 bg-slate-200 dark:bg-slate-700 rounded-xl mb-5"
                            ></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    const totalReports = reports.length;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6 md:p-8">
            <div className="max-w-5xl mx-auto">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                            <AlertTriangle className="w-8 h-8 text-amber-500" />
                            Product Reports
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
                            Review and moderate reported products
                        </p>
                    </div>
                    <div className="flex items-center gap-3 bg-white dark:bg-slate-800 px-4 py-2 rounded-full shadow-sm border border-slate-200 dark:border-slate-700">
                        <Clock className="w-4 h-4 text-amber-500" />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            {totalReports} pending {totalReports === 1 ? 'report' : 'reports'}
                        </span>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 transition hover:shadow-md">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-800 dark:text-white">
                                    {totalReports}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Pending Reports
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 transition hover:shadow-md">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                <ShoppingBag className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-800 dark:text-white">
                                    {reports.filter((r) => r.product).length}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Active Products
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 transition hover:shadow-md">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                                <EyeOff className="w-5 h-5 text-red-600 dark:text-red-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-800 dark:text-white">
                                    {reports.filter((r) => !r.product).length}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Deleted Products
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Reports List */}
                {totalReports === 0 ? (
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-12 text-center">
                        <div className="flex flex-col items-center">
                            <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-4">
                                <CheckCircle className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <h3 className="text-xl font-semibold text-slate-800 dark:text-white">
                                All Clear!
                            </h3>
                            <p className="text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                                No pending product reports at the moment. Keep up the good work!
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-5">
                        {reports.map((report) => (
                            <div
                                key={report.id}
                                className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600"
                            >
                                <div className="p-5 md:p-6">
                                    <div className="flex flex-col md:flex-row gap-5">

                                        {/* Product Image */}
                                        <div className="flex-shrink-0">
                                            <div className="relative w-full md:w-32 h-48 md:h-32 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-700">
                                                <img
                                                    src={
                                                        report.product?.images?.[0] ||
                                                        '/placeholder.png'
                                                    }
                                                    alt={report.product?.name || 'Product'}
                                                    className="w-full h-full object-cover"
                                                />
                                                {!report.product && (
                                                    <div className="absolute inset-0 bg-red-500/10 flex items-center justify-center">
                                                        <span className="text-xs font-medium text-red-600 dark:text-red-400 bg-white/80 dark:bg-slate-800/80 px-2 py-1 rounded-full">
                                                            Deleted
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                                                <div>
                                                    <h2 className="text-xl font-bold text-slate-800 dark:text-white truncate">
                                                        {report.product?.name || 'Deleted Product'}
                                                    </h2>
                                                    <div className="flex flex-wrap items-center gap-3 mt-1">
                                                        <span className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                                                            <User className="w-3.5 h-3.5" />
                                                            {report.targetOwnerId?.slice(0, 12) ||
                                                                'Unknown'}
                                                        </span>
                                                        <span className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                                                            <FileText className="w-3.5 h-3.5" />
                                                            ID: {report.id?.slice(0, 8)}
                                                        </span>
                                                    </div>
                                                </div>
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-medium rounded-full whitespace-nowrap">
                                                    <AlertCircle className="w-3.5 h-3.5" />
                                                    Pending
                                                </span>
                                            </div>

                                            {/* Report Details */}
                                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                                                <div>
                                                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                        Reason
                                                    </p>
                                                    <p className="text-sm font-medium text-slate-800 dark:text-white mt-0.5">
                                                        {report.reason || 'No reason provided'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                        Description
                                                    </p>
                                                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
                                                        {report.description || '-'}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="mt-5 flex flex-wrap gap-3">
                                                <button
                                                    onClick={() => hideProduct(report)}
                                                    disabled={actionLoading === report.id || !report.product}
                                                    className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 ${!report.product
                                                            ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                                                            : 'bg-red-600 hover:bg-red-700 text-white shadow-sm hover:shadow-red-200/50 dark:hover:shadow-red-900/30'
                                                        }`}
                                                >
                                                    {actionLoading === report.id ? (
                                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    ) : (
                                                        <>
                                                            <EyeOff className="w-4 h-4" />
                                                            Hide Product
                                                        </>
                                                    )}
                                                </button>

                                                <button
                                                    onClick={() => ignoreReport(report.id)}
                                                    disabled={actionLoading === report.id}
                                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
                                                >
                                                    {actionLoading === report.id ? (
                                                        <div className="w-4 h-4 border-2 border-slate-500/30 border-t-slate-500 rounded-full animate-spin" />
                                                    ) : (
                                                        <>
                                                            <XCircle className="w-4 h-4" />
                                                            Ignore Report
                                                        </>
                                                    )}
                                                </button>

                                                {report.product && (
                                                    <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40">
                                                        <Eye className="w-4 h-4" />
                                                        View Product
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}