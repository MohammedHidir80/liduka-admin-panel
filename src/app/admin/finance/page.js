'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { db } from '@/lib/firebase'
import {
    collection, getDocs, query, where, orderBy, limit, startAfter,
    doc, getDoc, updateDoc, addDoc, serverTimestamp
} from 'firebase/firestore'
import {
    Wallet, Users, Search, Filter, ChevronLeft, ChevronRight, Eye,
    CheckCircle, XCircle, RefreshCw, Clock, CreditCard, History,
    Banknote, Info, FileText
} from 'lucide-react'
import { ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { Dialog, Transition, Tab } from '@headlessui/react'
import toast from 'react-hot-toast'
import { format, subDays, subMonths, formatDistanceToNow } from 'date-fns'
import {
    AreaChart, Area, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { cn } from '@/utils/cn'

const USERS_PER_PAGE = 10

// Helper functions
const formatDate = (date) => {
    if (!date) return 'N/A'
    try {
        return format(new Date(date), 'PPP p')
    } catch {
        return 'Invalid date'
    }
}

const formatGHS = (amount) => `₵${Number(amount).toLocaleString()}`

// ------------------------------
// Custom hooks (unchanged)
// ------------------------------

function useWalletsSummary(refreshKey) {
    const [platformBalance, setPlatformBalance] = useState(0)
    const [totalVendorBalance, setTotalVendorBalance] = useState(0)
    const [totalBuyerBalance, setTotalBuyerBalance] = useState(0)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let isMounted = true
        async function fetchWallets() {
            if (!isMounted) return
            setLoading(true)
            try {
                const walletsSnap = await getDocs(collection(db, 'wallets'))
                let platform = 0, vendorTotal = 0, buyerTotal = 0
                walletsSnap.docs.forEach(doc => {
                    const w = doc.data()
                    if (w.type === 'platform') platform = w.balance || 0
                    else if (w.type === 'vendor') vendorTotal += w.balance || 0
                    else if (w.type === 'buyer') buyerTotal += w.balance || 0
                })
                if (isMounted) {
                    setPlatformBalance(platform)
                    setTotalVendorBalance(vendorTotal)
                    setTotalBuyerBalance(buyerTotal)
                }
            } catch (error) {
                console.error(error)
            } finally {
                if (isMounted) setLoading(false)
            }
        }
        fetchWallets()
        return () => { isMounted = false }
    }, [refreshKey])
    return { platformBalance, totalVendorBalance, totalBuyerBalance, loading }
}

function useTransactionChartData() {
    const [dailyData, setDailyData] = useState([])
    const [monthlyData, setMonthlyData] = useState([])

    useEffect(() => {
        let isMounted = true
        async function fetchData() {
            try {
                const q = query(collection(db, 'transactions'), orderBy('createdAt', 'desc'))
                const snapshot = await getDocs(q)
                const txns = snapshot.docs.map(d => ({ ...d.data(), createdAt: d.data().createdAt?.toDate?.() || d.data().createdAt }))

                // Last 30 days
                const last30Days = Array.from({ length: 30 }, (_, i) => {
                    const date = subDays(new Date(), i)
                    const dayStr = format(date, 'yyyy-MM-dd')
                    const dayTxns = txns.filter(t => format(new Date(t.createdAt), 'yyyy-MM-dd') === dayStr)
                    const credit = dayTxns.filter(t => t.type === 'credit').reduce((s, t) => s + (t.amount || 0), 0)
                    const debit = dayTxns.filter(t => t.type === 'debit').reduce((s, t) => s + (t.amount || 0), 0)
                    return { date: format(date, 'MMM dd'), credit, debit, net: credit - debit }
                }).reverse()
                // Last 6 months
                const last6Months = Array.from({ length: 6 }, (_, i) => {
                    const date = subMonths(new Date(), i)
                    const monthStr = format(date, 'MMM yyyy')
                    const monthTxns = txns.filter(t => format(new Date(t.createdAt), 'MMM yyyy') === monthStr)
                    const credit = monthTxns.filter(t => t.type === 'credit').reduce((s, t) => s + (t.amount || 0), 0)
                    const debit = monthTxns.filter(t => t.type === 'debit').reduce((s, t) => s + (t.amount || 0), 0)
                    return { month: format(date, 'MMM'), credit, debit, net: credit - debit }
                }).reverse()
                if (isMounted) {
                    setDailyData(last30Days)
                    setMonthlyData(last6Months)
                }
            } catch (error) {
                console.error(error)
            }
        }
        fetchData()
        return () => { isMounted = false }
    }, [])
    return { dailyData, monthlyData }
}

function useUsersWithWallets(refreshKey) {
    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let isMounted = true
        async function fetchUsers() {
            setLoading(true)
            try {
                const usersSnap = await getDocs(collection(db, 'users'))
                const walletsSnap = await getDocs(collection(db, 'wallets'))
                const walletMap = new Map()
                walletsSnap.docs.forEach(doc => {
                    const w = doc.data()
                    walletMap.set(w.userId, { id: doc.id, ...w })
                })
                const usersWithWallets = []
                for (const uDoc of usersSnap.docs) {
                    const user = uDoc.data()
                    const wallet = walletMap.get(uDoc.id) || { balance: 0, type: user.role }
                    usersWithWallets.push({
                        id: uDoc.id,
                        fullName: user.fullName || 'Unnamed',
                        email: user.email,
                        role: user.role,
                        walletId: wallet.id,
                        balance: wallet.balance || 0,
                        createdAt: user.createdAt?.toDate?.() || user.createdAt
                    })
                }
                if (isMounted) setUsers(usersWithWallets)
            } catch (error) {
                console.error(error)
            } finally {
                setLoading(false)
            }
        }
        fetchUsers()
        return () => { isMounted = false }
    }, [refreshKey])
    return { users, loading }
}

// Hook for pending withdrawals – now includes current balance and payout details
function usePendingWithdrawals(refreshKey) {
    const [withdrawals, setWithdrawals] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let isMounted = true
        async function fetchWithdrawals() {
            setLoading(true)
            try {
                const q = query(
                    collection(db, 'transactions'),
                    where('type', '==', 'withdrawal'),
                    where('status', '==', 'pending'),
                    orderBy('createdAt', 'desc')
                )
                const snapshot = await getDocs(q)
                const withdrawalsList = await Promise.all(snapshot.docs.map(async (docSnap) => {
                    const w = { id: docSnap.id, ...docSnap.data(), createdAt: docSnap.data().createdAt?.toDate?.() || docSnap.data().createdAt }
                    if (w.userId) {
                        const userDoc = await getDoc(doc(db, 'users', w.userId))
                        const user = userDoc.data()
                        w.vendorName = user?.fullName || 'Unknown'
                        w.vendorEmail = user?.email

                        // Get current wallet balance
                        const walletQuery = query(collection(db, 'wallets'), where('userId', '==', w.userId))
                        const walletSnap = await getDocs(walletQuery)
                        if (!walletSnap.empty) {
                            w.currentBalance = walletSnap.docs[0].data().balance || 0
                        } else {
                            w.currentBalance = 0
                        }

                        // Get payout details (bank account)
                        const payoutDoc = await getDoc(doc(db, 'payoutDetails', w.userId))
                        if (payoutDoc.exists()) {
                            const payout = payoutDoc.data()
                            w.payoutDetails = {
                                accountName: payout.accountName,
                                accountNumber: payout.accountNumber,
                                providerName: payout.providerName,
                                providerType: payout.providerType
                            }
                        } else {
                            w.payoutDetails = null
                        }
                    }
                    return w
                }))
                if (isMounted) setWithdrawals(withdrawalsList)
            } catch (error) {
                console.error(error)
            } finally {
                setLoading(false)
            }
        }
        fetchWithdrawals()
        return () => { isMounted = false }
    }, [refreshKey])
    return { withdrawals, loading }
}

// Component: Payout Details Modal
function PayoutDetailsModal({ payout, isOpen, onClose }) {
    if (!payout) return null
    return (
        <Transition show={isOpen} as={Dialog} onClose={onClose}>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                <Dialog.Panel className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6">
                    <Dialog.Title className="text-xl font-bold mb-4 dark:text-white">Payout Details</Dialog.Title>
                    <div className="space-y-3">
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Account Name</p>
                            <p className="font-medium dark:text-white">{payout.accountName || 'N/A'}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Account Number</p>
                            <p className="font-medium dark:text-white">{payout.accountNumber || 'N/A'}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Provider</p>
                            <p className="font-medium dark:text-white">{payout.providerName || payout.providerType || 'N/A'}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="btn-primary w-full mt-6">Close</button>
                </Dialog.Panel>
            </div>
        </Transition>
    )
}

// Component: Pending Withdrawals Table (enhanced)
function PendingWithdrawals({ withdrawals, loading, onRefresh }) {
    const [processing, setProcessing] = useState(null)
    const [selectedPayout, setSelectedPayout] = useState(null)
    const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false)

    const handleApprove = async (withdrawal) => {
        setProcessing(withdrawal.id)
        try {
            await updateDoc(doc(db, 'transactions', withdrawal.id), {
                status: 'success',
                processedAt: serverTimestamp(),
                processedBy: 'admin'
            })
            toast.success(`Withdrawal of ${formatGHS(withdrawal.amount)} approved`)
            onRefresh()
        } catch (error) {
            toast.error('Approval failed')
        } finally {
            setProcessing(null)
        }
    }

    const handleReject = async (withdrawal) => {
        setProcessing(withdrawal.id)
        try {
            await updateDoc(doc(db, 'transactions', withdrawal.id), {
                status: 'failed',
                processedAt: serverTimestamp(),
                processedBy: 'admin'
            })
            await addDoc(collection(db, 'transactions'), {
                amount: withdrawal.amount,
                type: 'credit',
                status: 'success',
                userId: withdrawal.userId,
                description: `Refund for rejected withdrawal request ${withdrawal.id}`,
                createdAt: serverTimestamp(),
                walletId: withdrawal.walletId
            })
            const walletQuery = query(collection(db, 'wallets'), where('userId', '==', withdrawal.userId))
            const walletSnap = await getDocs(walletQuery)
            if (!walletSnap.empty) {
                const walletRef = doc(db, 'wallets', walletSnap.docs[0].id)
                const currentBalance = walletSnap.docs[0].data().balance || 0
                await updateDoc(walletRef, { balance: currentBalance + withdrawal.amount })
            }
            toast.success(`Withdrawal rejected, funds returned to vendor wallet`)
            onRefresh()
        } catch (error) {
            toast.error('Rejection failed')
        } finally {
            setProcessing(null)
        }
    }

    if (loading) return <div className="text-center py-8">Loading pending withdrawals...</div>
    if (withdrawals.length === 0) return <div className="text-center py-8 text-gray-500">No pending withdrawal requests</div>

    return (
        <>
            <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-800 border-b">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Vendor</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Amount Requested</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Current Balance</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Requested On</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Payout Info</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {withdrawals.map(w => (
                                <tr key={w.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <p className="font-medium dark:text-white">{w.vendorName}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{w.vendorEmail}</p>
                                    </td>
                                    <td className="px-6 py-4 font-semibold text-yellow-600 dark:text-yellow-400">{formatGHS(w.amount)}</td>
                                    <td className="px-6 py-4 font-semibold text-green-600 dark:text-green-400">{formatGHS(w.currentBalance)}</td>
                                    <td className="px-6 py-4 text-sm dark:text-gray-300">{formatDate(w.createdAt)}</td>
                                    <td className="px-6 py-4">
                                        {w.payoutDetails ? (
                                            <button
                                                onClick={() => { setSelectedPayout(w.payoutDetails); setIsPayoutModalOpen(true) }}
                                                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
                                                title="View payout details"
                                            >
                                                <Banknote className="w-4 h-4" /> View
                                            </button>
                                        ) : (
                                            <span className="text-gray-400 text-xs">No details</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 flex gap-2">
                                        <button
                                            onClick={() => handleApprove(w)}
                                            disabled={processing === w.id}
                                            className="btn-primary text-sm px-3 py-1"
                                        >
                                            Approve
                                        </button>
                                        <button
                                            onClick={() => handleReject(w)}
                                            disabled={processing === w.id}
                                            className="btn-secondary text-sm px-3 py-1"
                                        >
                                            Reject
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <PayoutDetailsModal payout={selectedPayout} isOpen={isPayoutModalOpen} onClose={() => setIsPayoutModalOpen(false)} />
        </>
    )
}

// Component: User Detail Modal
function UserWalletModal({ user, isOpen, onClose }) {
    const [transactions, setTransactions] = useState([])
    const [loading, setLoading] = useState(false)
    const [balance, setBalance] = useState(0)

    useEffect(() => {
        if (!user || !isOpen) return
        let isMounted = true
        async function fetchUserData() {
            setLoading(true)
            try {
                const walletQuery = query(collection(db, 'wallets'), where('userId', '==', user.id))
                const walletSnap = await getDocs(walletQuery)
                if (!walletSnap.empty) {
                    setBalance(walletSnap.docs[0].data().balance || 0)
                }
                const txQuery = query(
                    collection(db, 'transactions'),
                    where('userId', '==', user.id),
                    orderBy('createdAt', 'desc'),
                    limit(50)
                )
                const txSnap = await getDocs(txQuery)
                const userTx = txSnap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate?.() || d.data().createdAt }))
                if (isMounted) setTransactions(userTx)
            } catch (error) {
                console.error(error)
                toast.error('Failed to load user data')
            } finally {
                setLoading(false)
            }
        }
        fetchUserData()
        return () => { isMounted = false }
    }, [user, isOpen])

    const totalCredits = transactions.filter(t => t.type === 'credit').reduce((s, t) => s + (t.amount || 0), 0)
    const totalDebits = transactions.filter(t => t.type === 'debit').reduce((s, t) => s + (t.amount || 0), 0)

    return (
        <Transition show={isOpen} as={Dialog} onClose={onClose}>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
                <Dialog.Panel className="bg-white dark:bg-gray-800 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                    <div className="sticky top-0 bg-white dark:bg-gray-800 border-b dark:border-gray-700 px-6 py-4 flex justify-between items-center">
                        <Dialog.Title className="text-xl font-bold dark:text-white">Wallet & Transactions</Dialog.Title>
                        <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><XCircle className="w-5 h-5 text-gray-500 dark:text-gray-400" /></button>
                    </div>
                    <div className="p-6 space-y-6">
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-3">
                                <Wallet className="w-6 h-6 mx-auto text-primary-600" />
                                <p className="text-2xl font-bold mt-1 dark:text-white">{formatGHS(balance)}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Current Balance</p>
                            </div>
                            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                                <ArrowUpCircle className="w-6 h-6 mx-auto text-green-600" />
                                <p className="text-2xl font-bold mt-1 dark:text-white">{formatGHS(totalCredits)}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Total Credits</p>
                            </div>
                            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                                <ArrowDownCircle className="w-6 h-6 mx-auto text-red-600" />
                                <p className="text-2xl font-bold mt-1 dark:text-white">{formatGHS(totalDebits)}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Total Debits</p>
                            </div>
                        </div>
                        <div>
                            <h4 className="text-lg font-semibold mb-3 flex items-center gap-2 dark:text-white"><History className="w-4 h-4" /> Transaction History</h4>
                            {loading ? (
                                <div className="text-center py-8">Loading...</div>
                            ) : transactions.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">No transactions found</div>
                            ) : (
                                <div className="space-y-2 max-h-96 overflow-y-auto">
                                    {transactions.map(tx => (
                                        <div key={tx.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                            <div>
                                                <p className="font-medium capitalize dark:text-white">{tx.type}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(tx.createdAt)}</p>
                                                {tx.description && <p className="text-xs text-gray-400 mt-1">{tx.description}</p>}
                                            </div>
                                            <div className="text-right">
                                                <p className={cn("font-semibold", tx.type === 'credit' ? 'text-green-600' : 'text-red-600')}>
                                                    {tx.type === 'credit' ? '+' : '-'}{formatGHS(tx.amount)}
                                                </p>
                                                <span className={cn("text-xs px-2 py-0.5 rounded-full", tx.status === 'success' ? 'bg-green-100 text-green-700' : tx.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700')}>
                                                    {tx.status}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-900 px-6 py-4 rounded-b-xl flex justify-end">
                        <button onClick={onClose} className="btn-secondary">Close</button>
                    </div>
                </Dialog.Panel>
            </div>
        </Transition>
    )
}

// Main Finance Page Component with PDF Export
export default function FinancePage() {
    const [refreshKey, setRefreshKey] = useState(0)
    const [selectedUser, setSelectedUser] = useState(null)
    const [isUserModalOpen, setIsUserModalOpen] = useState(false)
    const [userRoleFilter, setUserRoleFilter] = useState('all')
    const [searchTerm, setSearchTerm] = useState('')
    const [currentPage, setCurrentPage] = useState(1)

    const { platformBalance, totalVendorBalance, totalBuyerBalance } = useWalletsSummary(refreshKey)
    const { dailyData, monthlyData } = useTransactionChartData()
    const { users: allUsers, loading: usersLoading } = useUsersWithWallets(refreshKey)
    const { withdrawals: pendingWithdrawals, loading: withdrawalsLoading } = usePendingWithdrawals(refreshKey)

    const filteredUsers = allUsers.filter(u => {
        if (userRoleFilter !== 'all' && u.role !== userRoleFilter) return false
        if (searchTerm && !u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) && !u.email.toLowerCase().includes(searchTerm.toLowerCase())) return false
        return true
    }).slice((currentPage - 1) * USERS_PER_PAGE, currentPage * USERS_PER_PAGE)

    const totalUsersPages = Math.ceil(allUsers.filter(u => userRoleFilter === 'all' || u.role === userRoleFilter).length / USERS_PER_PAGE)

    const refreshData = useCallback(() => setRefreshKey(prev => prev + 1), [])

    // PDF Export handler
    const handleExportPDF = () => {
        // Add a class to body to hide non-printable elements, then print
        const originalTitle = document.title
        document.title = 'Finance Report - Marketplace Admin'
        
        // Create print styles dynamically
        const style = document.createElement('style')
        style.id = 'print-style'
        style.innerHTML = `
            @media print {
                body * {
                    visibility: hidden;
                }
                #print-area, #print-area * {
                    visibility: visible;
                }
                #print-area {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    padding: 20px;
                }
                .no-print, .btn-secondary, .btn-primary, button, .tab-list, .pagination-controls {
                    display: none !important;
                }
                .card {
                    break-inside: avoid;
                    page-break-inside: avoid;
                    border: 1px solid #ddd;
                    margin-bottom: 20px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                }
                th, td {
                    border: 1px solid #ddd;
                    padding: 8px;
                    text-align: left;
                }
                th {
                    background-color: #f2f2f2;
                }
            }
        `
        document.head.appendChild(style)
        
        window.print()
        
        document.head.removeChild(style)
        document.title = originalTitle
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-3">
                <div>
                    <h1 className="text-3xl font-bold">Finance & Payouts</h1>
                    <p className="text-gray-600 dark:text-gray-400">Monitor wallets, transactions, and approve vendor withdrawals</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleExportPDF} className="btn-secondary flex gap-2 items-center">
                        <FileText className="w-4 h-4" /> Export PDF
                    </button>
                    <button onClick={refreshData} className="btn-secondary flex gap-2">
                        <RefreshCw className="w-4 h-4" /> Refresh
                    </button>
                </div>
            </div>

            {/* Printable area wrapper */}
            <div id="print-area">
                {/* Stats Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="card p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">Platform Wallet</p><p className="text-2xl font-bold">{formatGHS(platformBalance)}</p></div><Wallet className="w-8 h-8 text-primary-500" /></div></div>
                    <div className="card p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">Total Vendor Balances</p><p className="text-2xl font-bold">{formatGHS(totalVendorBalance)}</p></div><Users className="w-8 h-8 text-green-500" /></div></div>
                    <div className="card p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">Total Buyer Balances</p><p className="text-2xl font-bold">{formatGHS(totalBuyerBalance)}</p></div><CreditCard className="w-8 h-8 text-purple-500" /></div></div>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="card p-6"><h3 className="font-semibold mb-4">Daily Trend (30 days)</h3><ResponsiveContainer width="100%" height={300}><AreaChart data={dailyData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis tickFormatter={v => `₵${v}`} /><Tooltip formatter={v => `₵${v}`} /><Legend /><Area type="monotone" dataKey="credit" fill="#10b981" stroke="#10b981" name="Credits" /><Area type="monotone" dataKey="debit" fill="#ef4444" stroke="#ef4444" name="Debits" /></AreaChart></ResponsiveContainer></div>
                    <div className="card p-6"><h3 className="font-semibold mb-4">Monthly Net Revenue</h3><ResponsiveContainer width="100%" height={300}><BarChart data={monthlyData}><CartesianGrid /><XAxis dataKey="month" /><YAxis /><Tooltip /><Legend /><Bar dataKey="net" fill="#3b82f6" name="Net (Credit-Debit)" /></BarChart></ResponsiveContainer></div>
                </div>

                {/* Tabs (visible in print as well) */}
                <Tab.Group>
                    <Tab.List className="flex space-x-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1 tab-list">
                        <Tab className={({ selected }) => cn("w-full rounded-lg py-2.5 text-sm font-medium", selected ? "bg-white dark:bg-gray-700 shadow text-primary-700" : "text-gray-600")}>User Wallets & History</Tab>
                        <Tab className={({ selected }) => cn("w-full rounded-lg py-2.5 text-sm font-medium", selected ? "bg-white dark:bg-gray-700 shadow text-primary-700" : "text-gray-600")}>Pending Withdrawals</Tab>
                    </Tab.List>
                    <Tab.Panels className="mt-6">
                        {/* User Wallets Panel */}
                        <Tab.Panel>
                            <div className="flex flex-col sm:flex-row gap-4 mb-6 no-print">
                                <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" /><input type="text" placeholder="Search by name or email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="input pl-9" /></div>
                                <div className="relative"><Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" /><select value={userRoleFilter} onChange={e => { setUserRoleFilter(e.target.value); setCurrentPage(1) }} className="input pl-9"><option value="all">All Roles</option><option value="vendor">Vendors</option><option value="buyer">Buyers</option></select></div>
                            </div>
                            <div className="card overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-gray-50 border-b">
                                            <tr><th className="px-6 py-3 text-left">User</th><th className="px-6 py-3 text-left">Role</th><th className="px-6 py-3 text-left">Wallet Balance</th><th className="px-6 py-3 text-left no-print">Actions</th></tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {usersLoading ? <tr><td colSpan="4" className="px-6 py-8 text-center">Loading...</td></tr> : filteredUsers.map(u => (
                                                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                                    <td className="px-6 py-4"><p className="font-medium dark:text-white">{u.fullName}</p><p className="text-xs text-gray-500 dark:text-gray-400">{u.email}</p></td>
                                                    <td className="px-6 py-4 capitalize dark:text-gray-300">{u.role}</td>
                                                    <td className="px-6 py-4 font-semibold text-green-600 dark:text-green-400">{formatGHS(u.balance)}</td>
                                                    <td className="px-6 py-4 no-print"><button onClick={() => { setSelectedUser(u); setIsUserModalOpen(true) }} className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"><Eye className="w-5 h-5" /></button></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {totalUsersPages > 1 && <div className="px-6 py-4 border-t flex justify-between no-print"><button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="btn-secondary disabled:opacity-50"><ChevronLeft className="w-4 h-4" /></button><span>Page {currentPage} of {totalUsersPages}</span><button disabled={currentPage === totalUsersPages} onClick={() => setCurrentPage(p => p + 1)} className="btn-secondary disabled:opacity-50"><ChevronRight className="w-4 h-4" /></button></div>}
                            </div>
                        </Tab.Panel>
                        {/* Pending Withdrawals Panel */}
                        <Tab.Panel>
                            <PendingWithdrawals withdrawals={pendingWithdrawals} loading={withdrawalsLoading} onRefresh={refreshData} />
                        </Tab.Panel>
                    </Tab.Panels>
                </Tab.Group>
            </div>

            <UserWalletModal user={selectedUser} isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} />
        </div>
    )
}