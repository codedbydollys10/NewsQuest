import { createContext, useContext, type ReactNode } from 'react';
import { useBattleSocket, type BattleSocketContextValue } from '@/hooks/useBattleSocket';

const BattleSocketContext = createContext<BattleSocketContextValue | null>(null);

export const BattleSocketProvider = ({ children }: { children: ReactNode }) => {
    const socketState = useBattleSocket();
    return <BattleSocketContext.Provider value={socketState}>{children}</BattleSocketContext.Provider>;
};

export const useBattleSocketContext = () => {
    const context = useContext(BattleSocketContext);
    if (!context) {
        throw new Error('useBattleSocketContext must be used within BattleSocketProvider');
    }
    return context;
};