import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth'

import { auth, db } from './firebase'
import { doc, getDoc } from 'firebase/firestore'
import toast from 'react-hot-toast'

export const loginWithEmail = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    )

    const user = userCredential.user

    // Check users collection
    const userDoc = await getDoc(doc(db, 'users', user.uid))

    if (!userDoc.exists()) {
      await signOut(auth)
      throw new Error('User account not found')
    }

    const userData = userDoc.data()

    // Allowed admin roles
    const allowedRoles = [
      'super_admin',
      'admin',
      'moderator',
      'support_agent',
      'finance_admin',
      'logistics_admin'
    ]

    // Verify role
    if (!allowedRoles.includes(userData.role)) {
      await signOut(auth)
      throw new Error('Unauthorized: Not an admin user')
    }

    return {
      user,
      adminData: userData,
    }
  } catch (error) {
    toast.error(error.message)
    throw error
  }
}

export const logout = async () => {
  try {
    await signOut(auth)
    toast.success('Logged out successfully')
  } catch (error) {
    toast.error(error.message)
    throw error
  }
}

export const resetPassword = async (email) => {
  try {
    await sendPasswordResetEmail(auth, email)
    toast.success('Password reset email sent!')
  } catch (error) {
    toast.error(error.message)
    throw error
  }
}