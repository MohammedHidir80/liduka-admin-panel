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
    const userDoc = await getDoc(
      doc(db, 'users', user.uid)
    )


    if (!userDoc.exists()) {

      await signOut(auth)

      throw new Error(
        'User account not found'
      )
    }


    const userData = userDoc.data()


    const allowedRoles = [
      'super_admin',
      'admin',
      'moderator',
      'support_agent',
      'finance_admin',
      'logistics_admin'
    ]


    if (!allowedRoles.includes(userData.role)) {

      await signOut(auth)

      throw new Error(
        'Unauthorized admin account'
      )
    }


    // Create simple admin session
    const sessionId =
      crypto.randomUUID()


    document.cookie = [
      `adminSession=${sessionId}`,
      'Path=/',
      'Max-Age=86400',
      'SameSite=Lax',
      window.location.protocol === 'https:' 
        ? 'Secure'
        : ''
    ]
      .filter(Boolean)
      .join('; ')



    return {
      user,
      adminData:userData,
    }


  } catch(error){

    toast.error(error.message)

    throw error
  }
}



export const logout = async () => {

  try {

    await signOut(auth)


    document.cookie =
      'adminSession=; Path=/; Max-Age=0; SameSite=Lax'


    toast.success(
      'Logged out successfully'
    )


  } catch(error){

    toast.error(error.message)

    throw error
  }

}



export const resetPassword = async(email)=>{

  try{

    await sendPasswordResetEmail(
      auth,
      email
    )


    toast.success(
      'Password reset email sent!'
    )


  }catch(error){

    toast.error(error.message)

    throw error
  }

}