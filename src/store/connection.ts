import { create } from 'zustand'
import type { ConnectionStatus } from '#/lib/ws/types'

/** Estado de la conexión WebSocket, para que la UI muestre un indicador. */
interface ConnectionState {
  status: ConnectionStatus
  setStatus: (status: ConnectionStatus) => void
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  status: 'idle',
  setStatus: (status) => set({ status }),
}))
