'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Utensils, Save, Coffee, Sun, Sunset, Moon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getHostels, getHostelMenu, updateHostelMenu } from '@/actions/hostel-actions';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SLOTS = [
    { key: 'morning_slot', label: 'Morning', time: '07:00 - 07:30 AM', icon: Coffee, color: 'text-orange-500' },
    { key: 'afternoon_slot', label: 'Afternoon', time: '12:30 - 01:30 PM', icon: Sun, color: 'text-amber-500' },
    { key: 'evening_slot', label: 'Evening', time: '05:30 - 06:00 PM', icon: Sunset, color: 'text-rose-500' },
    { key: 'dinner_slot', label: 'Dinner', time: '08:00 - 09:00 PM', icon: Moon, color: 'text-indigo-500' }
];

export default function HostelMenuPage() {
    const [hostels, setHostels] = React.useState<any[]>([]);
    const [selectedHostel, setSelectedHostel] = React.useState<string>('');
    const [menuData, setMenuData] = React.useState<Record<string, any>>({});
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState<Record<string, boolean>>({});
    const { toast } = useToast();

    // Fetch Hostels on Mount
    React.useEffect(() => {
        const fetchHostels = async () => {
            setIsLoading(true);
            try {
                const data = await getHostels();
                setHostels(data);
                if (data.length > 0) {
                    setSelectedHostel(data[0].id);
                }
            } catch (err) {
                toast({ variant: "destructive", title: "Error", description: "Failed to load hostels." });
            } finally {
                setIsLoading(false);
            }
        };
        fetchHostels();
    }, [toast]);

    // Fetch Menu when Hostel changes
    React.useEffect(() => {
        const fetchMenu = async () => {
            if (!selectedHostel) return;
            setIsLoading(true);
            try {
                const data = await getHostelMenu(selectedHostel);
                const mappedData: Record<string, any> = {};
                DAYS.forEach(day => {
                    const dayData = data.find((d: any) => d.day_of_week === day) || {};
                    mappedData[day] = {
                        morning_slot: dayData.morning_slot || '',
                        afternoon_slot: dayData.afternoon_slot || '',
                        evening_slot: dayData.evening_slot || '',
                        dinner_slot: dayData.dinner_slot || ''
                    };
                });
                setMenuData(mappedData);
            } catch (err) {
                toast({ variant: "destructive", title: "Error", description: "Failed to load menu data." });
            } finally {
                setIsLoading(false);
            }
        };
        fetchMenu();
    }, [selectedHostel, toast]);

    const handleMenuChange = (day: string, slot: string, value: string) => {
        setMenuData(prev => ({
            ...prev,
            [day]: {
                ...prev[day],
                [slot]: value
            }
        }));
    };

    const handleSaveDay = async (day: string) => {
        if (!selectedHostel) return;
        setIsSaving(prev => ({ ...prev, [day]: true }));
        try {
            const payload = menuData[day];
            const res = await updateHostelMenu(selectedHostel, day, payload);
            if (res.success) {
                toast({ title: "Menu Saved", description: `${day}'s menu updated successfully.` });
            } else {
                toast({ variant: "destructive", title: "Update Failed", description: res.error });
            }
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: "Internal server error." });
        } finally {
            setIsSaving(prev => ({ ...prev, [day]: false }));
        }
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-400 to-amber-600 text-white shadow-lg shadow-amber-500/30">
                            <Utensils className="h-5 w-5" />
                        </div>
                        Food Menu Timetable
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm sm:text-base">Manage the weekly dining menu for the hostel.</p>
                </div>
                
                <div className="w-full sm:w-64">
                    <Select value={selectedHostel} onValueChange={setSelectedHostel} disabled={isLoading || hostels.length === 0}>
                        <SelectTrigger className="w-full bg-background border-primary/20 shadow-sm">
                            <SelectValue placeholder="Select a Hostel" />
                        </SelectTrigger>
                        <SelectContent>
                            {hostels.map(h => (
                                <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <Card className="shadow-xl border-0 overflow-hidden bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm ring-1 ring-black/5 dark:ring-white/10 rounded-2xl">
                <CardHeader className="bg-muted/30 border-b">
                    <CardTitle className="text-lg flex items-center gap-2">
                        Weekly Meal Planner
                    </CardTitle>
                    <CardDescription>Changes made will reflect immediately on the student portal.</CardDescription>
                </CardHeader>
                <div className="overflow-x-auto min-h-[500px]">
                    {isLoading && Object.keys(menuData).length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-24 text-muted-foreground">
                            <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
                            <p>Loading menu data...</p>
                        </div>
                    ) : (
                        <Table className="min-w-[900px]">
                            <TableHeader>
                                <TableRow className="bg-muted/20 hover:bg-muted/20">
                                    <TableHead className="w-32 font-bold text-foreground bg-primary/5">Day</TableHead>
                                    {SLOTS.map(slot => {
                                        const Icon = slot.icon;
                                        return (
                                            <TableHead key={slot.key} className="min-w-[180px]">
                                                <div className="flex flex-col items-start justify-center gap-1">
                                                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                                                        <Icon className={`w-4 h-4 ${slot.color}`} />
                                                        {slot.label}
                                                    </div>
                                                    <span className="text-xs text-muted-foreground font-normal">{slot.time}</span>
                                                </div>
                                            </TableHead>
                                        );
                                    })}
                                    <TableHead className="w-24 text-right bg-primary/5">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {DAYS.map(day => (
                                    <TableRow key={day} className="hover:bg-muted/30 transition-colors group">
                                        <TableCell className="font-semibold bg-primary/5">{day}</TableCell>
                                        {SLOTS.map(slot => (
                                            <TableCell key={`${day}-${slot.key}`} className="p-2 align-top">
                                                <Input 
                                                    value={menuData[day]?.[slot.key] || ''}
                                                    onChange={(e) => handleMenuChange(day, slot.key, e.target.value)}
                                                    placeholder={`Enter ${slot.label.toLowerCase()} menu...`}
                                                    className="w-full text-sm bg-background border-transparent hover:border-border focus:border-primary transition-colors h-10 resize-none placeholder:text-muted-foreground/50"
                                                />
                                            </TableCell>
                                        ))}
                                        <TableCell className="text-right align-middle bg-primary/5">
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="opacity-0 group-hover:opacity-100 transition-opacity bg-primary/10 hover:bg-primary hover:text-primary-foreground border-transparent"
                                                onClick={() => handleSaveDay(day)}
                                                disabled={isSaving[day]}
                                            >
                                                {isSaving[day] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </div>
            </Card>
        </div>
    );
}
