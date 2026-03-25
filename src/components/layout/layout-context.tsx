
"use client";

import * as React from "react";

interface LayoutContextType {
    headerActions: React.ReactNode | null;
    setHeaderActions: (actions: React.ReactNode | null) => void;
}

const LayoutContext = React.createContext<LayoutContextType | undefined>(undefined);

export function LayoutProvider({ children }: { children: React.ReactNode }) {
    const [headerActions, setHeaderActions] = React.useState<React.ReactNode | null>(null);

    return (
        <LayoutContext.Provider value={{ headerActions, setHeaderActions }}>
            {children}
        </LayoutContext.Provider>
    );
}

export function useLayout() {
    const context = React.useContext(LayoutContext);
    if (context === undefined) {
        throw new Error("useLayout must be used within a LayoutProvider");
    }
    return context;
}

/**
 * Component to be used within a page to set the header actions for that page.
 * It automatically clears the actions when the component unmounts.
 */
export function PageHeaderActions({ children }: { children: React.ReactNode }) {
    const { setHeaderActions } = useLayout();

    React.useEffect(() => {
        setHeaderActions(children);
        return () => setHeaderActions(null);
    }, [children, setHeaderActions]);

    return null;
}
