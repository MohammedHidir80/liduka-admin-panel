'use client'

import { useState, useEffect, useCallback, Fragment, useRef } from 'react'
import Image from 'next/image'
import {
    collection,
    getDocs,
    query,
    orderBy,
    limit,
    doc,
    updateDoc,
    addDoc,
    serverTimestamp,
    onSnapshot,
    where
} from 'firebase/firestore'
import { Dialog, Transition } from '@headlessui/react'
import {
    MessageCircle,
    AlertTriangle,
    RefreshCw,
    Search,
    Eye,
    Clock,
    CheckCircle2,
    XCircle,
    MessageSquare,
    Image as ImageIcon,
    ExternalLink,
    Send
} from 'lucide-react'
import { db } from '@/lib/firebase'
import toast from 'react-hot-toast'
import { cn } from '@/utils/cn'

// Helper functions
const formatDate = (date) => {
    if (!date) return 'N/A'
    try {
        return new Date(date).toLocaleString()
    } catch {
        return 'N/A'
    }
}

// ------------------------------
// Custom hook for disputes data
// ------------------------------
function useDisputesData() {
    const [issues, setIssues] = useState([])
    const [chats, setChats] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const fetchData = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const issuesQuery = query(
                collection(db, 'issues'),
                orderBy('createdAt', 'desc'),
                limit(100)
            )
            const chatsQuery = query(
                collection(db, 'chats'),
                orderBy('lastActivity', 'desc'),
                limit(100)
            )
            const [issuesSnapshot, chatsSnapshot] = await Promise.all([
                getDocs(issuesQuery),
                getDocs(chatsQuery),
            ])

            const issuesData = issuesSnapshot.docs.map((docSnap) => ({
                id: docSnap.id,
                ...docSnap.data(),
                createdAt:
                    docSnap.data().createdAt?.toDate?.() ||
                    docSnap.data().createdAt,
            }))

            const chatsData = chatsSnapshot.docs.map((docSnap) => ({
                id: docSnap.id,
                ...docSnap.data(),
                createdAt:
                    docSnap.data().createdAt?.toDate?.() ||
                    docSnap.data().createdAt,
                lastActivity:
                    docSnap.data().lastActivity?.toDate?.() ||
                    docSnap.data().lastActivity,
                endedAt:
                    docSnap.data().endedAt?.toDate?.() ||
                    docSnap.data().endedAt,
            }))

            setIssues(issuesData)
            setChats(chatsData)
        } catch (err) {
            console.error(err)
            setError(err.message)
            toast.error('Failed to load data')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const updateIssueStatus = async (issueId, status) => {
        try {
            await updateDoc(doc(db, 'issues', issueId), { status })
            setIssues((prev) =>
                prev.map((issue) =>
                    issue.id === issueId ? { ...issue, status } : issue
                )
            )
            toast.success(`Issue marked as ${status}`)
        } catch (err) {
            console.error(err)
            toast.error('Failed to update status')
        }
    }

    return { issues, chats, loading, error, refresh: fetchData, updateIssueStatus }
}

// ------------------------------
// Issue Detail Modal
// ------------------------------
function IssueModal({ issue, isOpen, onClose, onUpdateStatus }) {
    if (!issue) return null

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/50" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-2xl max-h-[90vh] overflow-y-auto transform rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-xl transition-all">
                                <div className="flex justify-between items-center mb-4">
                                    <Dialog.Title className="text-2xl font-bold dark:text-white">
                                        Issue Details
                                    </Dialog.Title>
                                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400">
                                        <XCircle className="w-6 h-6" />
                                    </button>
                                </div>

                                <div className="space-y-5">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">User</p>
                                            <p className="font-semibold dark:text-white">{issue.userName || 'Unknown'}</p>
                                        </div>
                                        <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Role</p>
                                            <p className="font-semibold capitalize dark:text-white">{issue.role}</p>
                                        </div>
                                        <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Category</p>
                                            <p className="font-semibold dark:text-white">{issue.categoryLabel || issue.category}</p>
                                        </div>
                                        <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Status</p>
                                            <p className="font-semibold capitalize dark:text-white">{issue.status}</p>
                                        </div>
                                    </div>

                                    <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Description</p>
                                        <p className="leading-7 dark:text-gray-300">{issue.description}</p>
                                    </div>

                                    {issue.screenshot && (
                                        <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                                            <div className="flex items-center gap-2 mb-3">
                                                <ImageIcon className="w-5 h-5 text-gray-500" />
                                                <p className="font-semibold dark:text-white">Screenshot</p>
                                            </div>
                                            <div className="relative w-full h-80">
                                                <Image
                                                    src={issue.screenshot}
                                                    alt="Issue Screenshot"
                                                    fill
                                                    className="rounded-lg object-contain"
                                                    unoptimized
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex flex-wrap gap-3 pt-2">
                                        <button
                                            onClick={() => onUpdateStatus(issue.id, 'reviewing')}
                                            className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                                        >
                                            Mark Reviewing
                                        </button>
                                        <button
                                            onClick={() => onUpdateStatus(issue.id, 'resolved')}
                                            className="px-5 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors"
                                        >
                                            Mark Resolved
                                        </button>
                                        <button
                                            onClick={() => onUpdateStatus(issue.id, 'rejected')}
                                            className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
                                        >
                                            Reject Issue
                                        </button>
                                    </div>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    )
}

// ------------------------------
// Chat Conversation Modal (Full conversation)
// ------------------------------
function ChatModal({ chat, isOpen, onClose }) {
    const [messages, setMessages] = useState([])
    const [loadingMessages, setLoadingMessages] = useState(false)
    const [newMessage, setNewMessage] = useState('')
    const [sending, setSending] = useState(false)
    const messagesEndRef = useRef(null)

    // Fetch messages when chat opens
    useEffect(() => {
        if (!chat || !isOpen) return

        let isMounted = true

        const messagesRef = collection(db, 'chats', chat.id, 'messages')

        const q = query(
            messagesRef,
            orderBy('timestamp', 'asc')
        )

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {

                const msgs = snapshot.docs.map((docSnap) => ({
                    id: docSnap.id,
                    ...docSnap.data(),
                    timestamp:
                        docSnap.data().timestamp?.toDate?.() ||
                        docSnap.data().timestamp,
                }))

                if (isMounted) {
                    setMessages(msgs)
                }

                setTimeout(() => {
                    messagesEndRef.current?.scrollIntoView({
                        behavior: 'smooth',
                    })
                }, 100)
            },
            (error) => {
                console.error('Error fetching messages:', error)
                toast.error('Failed to load messages')
            }
        )

        return () => {
            isMounted = false
            unsubscribe()
        }
    }, [chat, isOpen])

    // Send a new message as admin
    const sendMessage = async () => {
        if (!newMessage.trim()) return
        setSending(true)
        try {
            const messagesRef = collection(db, 'chats', chat.id, 'messages')
            await addDoc(messagesRef, {
                text: newMessage.trim(),
                sender: 'admin',
                senderName: 'Admin Support',
                timestamp: serverTimestamp(),
                read: false
            })
            // Update parent chat's lastActivity
            await updateDoc(doc(db, 'chats', chat.id), {
                lastActivity: serverTimestamp()
            })
            setNewMessage('')
            toast.success('Message sent')
        } catch (err) {
            console.error(err)
            toast.error('Failed to send message')
        } finally {
            setSending(false)
        }
    }

    if (!chat) return null

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/50" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 py-10">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-xl transition-all flex flex-col h-[600px]">
                                {/* Header */}
                                <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
                                    <div>
                                        <Dialog.Title className="text-xl font-bold dark:text-white">
                                            Support Conversation
                                        </Dialog.Title>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            Chat ID: {chat.id.slice(0, 12)}... · User: {chat.userId}
                                        </p>
                                    </div>
                                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400">
                                        <XCircle className="w-6 h-6" />
                                    </button>
                                </div>

                                {/* Messages area */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                    {messages.length === 0 ? (
                                        <div className="text-center text-gray-500 py-10">No messages yet</div>
                                    ) : (
                                        messages.map(msg => (
                                            <div
                                                key={msg.id}
                                                className={cn(
                                                    "flex",
                                                    msg.sender === 'admin' ? "justify-end" : "justify-start"
                                                )}
                                            >
                                                <div
                                                    className={cn(
                                                        "max-w-[70%] rounded-lg px-4 py-2",
                                                        msg.sender === 'admin'
                                                            ? "bg-primary-600 text-white"
                                                            : "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                                    )}
                                                >
                                                    {/* TEXT MESSAGE */}
                                                    {msg.text && (
                                                        <p className="text-sm break-words">
                                                            {msg.text}
                                                        </p>
                                                    )}

                                                    {/* IMAGE MESSAGE */}
                                                    {msg.imageUrl && (
                                                        <div className="mt-2">
                                                            <Image
                                                                src={msg.imageUrl}
                                                                alt="Chat image"
                                                                width={250}
                                                                height={250}
                                                                className="rounded-lg object-cover"
                                                                unoptimized
                                                            />

                                                            <a
                                                                href={msg.imageUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex items-center gap-1 text-xs mt-2 underline"
                                                            >
                                                                <ExternalLink className="w-3 h-3" />
                                                                Open Image
                                                            </a>
                                                        </div>
                                                    )}

                                                    <p className="text-xs mt-2 opacity-70">
                                                        {msg.sender === 'admin'
                                                            ? 'Admin'
                                                            : msg.senderName || 'User'} · {formatDate(msg.timestamp)}
                                                    </p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Input area */}
                                <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                                            placeholder="Type your reply..."
                                            className="input flex-1"
                                        />
                                        <button
                                            onClick={sendMessage}
                                            disabled={sending || !newMessage.trim()}
                                            className="btn-primary px-4 disabled:opacity-50 flex items-center gap-2"
                                        >
                                            <Send className="w-4 h-4" />
                                            Send
                                        </button>
                                    </div>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    )
}

// ------------------------------
// Main Disputes Page
// ------------------------------
export default function DisputesPage() {
    const [searchTerm, setSearchTerm] = useState('')
    const [issueStatusFilter, setIssueStatusFilter] = useState('all')
    const [selectedIssue, setSelectedIssue] = useState(null)
    const [selectedChat, setSelectedChat] = useState(null)

    const { issues, chats, loading, error, refresh, updateIssueStatus } = useDisputesData()

    // Stats
    const totalIssues = issues.length
    const pendingIssues = issues.filter(issue => issue.status === 'pending').length
    const resolvedIssues = issues.filter(issue => issue.status === 'resolved').length
    const openChats = chats.filter(chat => chat.status === 'open').length

    // Filtered issues
    const filteredIssues = issues.filter(issue => {
        const matchesSearch =
            issue.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            issue.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            issue.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            issue.categoryLabel?.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesStatus = issueStatusFilter === 'all' || issue.status === issueStatusFilter
        return matchesSearch && matchesStatus
    })

    if (error) {
        return (
            <div className="card p-12 text-center">
                <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">Error Loading Data</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
                <button onClick={refresh} className="btn-primary">Retry</button>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Disputes & Support</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        Manage support chats, reported issues, disputes and escalations.
                    </p>
                </div>
                <button
                    onClick={refresh}
                    className="btn-secondary flex items-center gap-2"
                >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="card p-6">
                    <AlertTriangle className="w-8 h-8 text-orange-500 mb-3" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Issues</p>
                    <p className="text-3xl font-bold dark:text-white">{totalIssues}</p>
                </div>
                <div className="card p-6">
                    <Clock className="w-8 h-8 text-yellow-500 mb-3" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">Pending Issues</p>
                    <p className="text-3xl font-bold dark:text-white">{pendingIssues}</p>
                </div>
                <div className="card p-6">
                    <CheckCircle2 className="w-8 h-8 text-green-500 mb-3" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">Resolved Issues</p>
                    <p className="text-3xl font-bold dark:text-white">{resolvedIssues}</p>
                </div>
                <div className="card p-6">
                    <MessageCircle className="w-8 h-8 text-blue-500 mb-3" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">Open Support Chats</p>
                    <p className="text-3xl font-bold dark:text-white">{openChats}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search issues..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="input pl-9"
                    />
                </div>
                <div className="relative w-48">
                    <select
                        value={issueStatusFilter}
                        onChange={(e) => setIssueStatusFilter(e.target.value)}
                        className="input appearance-none cursor-pointer"
                    >
                        <option value="all">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="reviewing">Reviewing</option>
                        <option value="resolved">Resolved</option>
                        <option value="rejected">Rejected</option>
                    </select>
                </div>
            </div>

            {/* Issues Table */}
            <div className="card overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-semibold">Reported Issues</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-800 border-b">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {loading ? (
                                <tr><td colSpan="6" className="px-6 py-10 text-center text-gray-500">Loading issues...</td></tr>
                            ) : filteredIssues.length === 0 ? (
                                <tr><td colSpan="6" className="px-6 py-10 text-center text-gray-500">No issues found</td></tr>
                            ) : (
                                filteredIssues.map(issue => (
                                    <tr key={issue.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <p className="font-medium dark:text-white">{issue.userName || 'Unknown'}</p>
                                            <p className="text-xs text-gray-500">{issue.userEmail || 'No email'}</p>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                                            {issue.categoryLabel || issue.category}
                                        </td>
                                        <td className="px-6 py-4 capitalize text-gray-600 dark:text-gray-300">{issue.role}</td>
                                        <td className="px-6 py-4">
                                            <span className={cn(
                                                "px-2 py-1 text-xs rounded-full",
                                                issue.status === 'resolved' && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                                                issue.status === 'pending' && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
                                                issue.status === 'reviewing' && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                                                issue.status === 'rejected' && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                            )}>
                                                {issue.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">{formatDate(issue.createdAt)}</td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => setSelectedIssue(issue)}
                                                className="text-blue-600 hover:text-blue-700"
                                                title="View details"
                                            >
                                                <Eye className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Support Chats Section */}
            <div className="card overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-semibold">Support Chats</h2>
                </div>
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {loading ? (
                        <div className="p-6 text-center text-gray-500">Loading chats...</div>
                    ) : chats.length === 0 ? (
                        <div className="p-6 text-center text-gray-500">No chats found</div>
                    ) : (
                        chats.map(chat => (
                            <div key={chat.id} className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <MessageSquare className="w-4 h-4 text-blue-500" />
                                        <p className="font-semibold dark:text-white">Chat ID: {chat.id.slice(0, 10)}...</p>
                                    </div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">User ID: {chat.userId}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Last Activity: {formatDate(chat.lastActivity)}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={cn(
                                        "px-2 py-1 text-xs rounded-full",
                                        chat.status === 'open' ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400"
                                    )}>
                                        {chat.status}
                                    </span>
                                    <button
                                        onClick={() => setSelectedChat(chat)}
                                        className="btn-secondary flex items-center gap-2 text-sm"
                                    >
                                        <Eye className="w-4 h-4" />
                                        Open Conversation
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Modals */}
            <IssueModal
                issue={selectedIssue}
                isOpen={!!selectedIssue}
                onClose={() => setSelectedIssue(null)}
                onUpdateStatus={updateIssueStatus}
            />
            <ChatModal
                chat={selectedChat}
                isOpen={!!selectedChat}
                onClose={() => setSelectedChat(null)}
            />
        </div>
    )
}