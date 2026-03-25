
'use client';

import * as React from 'react';
import { getAdminDashboardStats, type AdminDashboardData } from '@/actions/dashboard-actions';
import { AdminDashboardClient } from '@/components/admin/dashboard/admin-dashboard-client';
import { Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from '@/components/ui/button';

export default function AdminDashboardPage() {
    const [dashboardData, setDashboardData] = React.useState<AdminDashboardData | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    const loadData = React.useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await getAdminDashboardStats();
            setDashboardData(data);
        } catch (err: any) {
            console.error("Failed to load dashboard data:", err);
            setError("Could not load your dashboard data. Please try refreshing.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    React.useEffect(() => {
        loadData();
    }, [loadData]);

    if (isLoading) {
        return (
            <div className="flex flex-col justify-center items-center h-64 gap-4 animate-fade-in" role="status" aria-label="Loading dashboard">
                <div className="relative">
                  <div className="h-12 w-12 rounded-full border-4 border-muted" />
                  <div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                </div>
                <span className="text-sm text-muted-foreground font-medium">Loading dashboard data...</span>
            </div>
        );
    }

    if (error || !dashboardData) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in" role="alert">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 mb-4">
                  <AlertTriangle className="h-7 w-7 text-destructive" />
                </div>
                <h2 className="text-lg font-semibold">Failed to Load Data</h2>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">{error || "Dashboard data could not be loaded."}</p>
                <Button onClick={loadData} className="mt-4" variant="outline">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Try Again
                </Button>
            </div>
        );
    }

    return <AdminDashboardClient initialData={dashboardData} />;
}
