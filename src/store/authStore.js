import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      adminData: null,
      permissions: {},
      isLoading: true,
      setUser: (user) => set({ user }),
      setAdminData: (adminData) => set({ adminData }),
      setPermissions: (permissions) => set({ permissions }),
      setIsLoading: (isLoading) => set({ isLoading }),
      logout: () => set({ user: null, adminData: null, permissions: {}, isLoading: false }),
    }),
    {
      name: 'auth-storage',
      getStorage: () => localStorage,
    }
  )
)

export default useAuthStore