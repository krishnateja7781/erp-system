'use client';

import * as React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, GraduationCap } from "lucide-react";
import AdminStudentsPage from '@/app/(app)/admin/students/page';
import { EmployeeTeachersTab } from './employee-teachers-tab';

export default function EmployeeUsersPage() {
  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 p-8 text-white shadow-lg">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Users Management</h1>
            <p className="text-white/80 text-sm mt-2">
              Manage student enrollments and teaching staff directories.
            </p>
          </div>
          <Users className="h-16 w-16 opacity-20" />
        </div>
        <div className="absolute top-0 left-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 -content translate-x-1/2" />
      </div>

      <Tabs defaultValue="students" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto mb-8 bg-muted/50 p-1">
          <TabsTrigger value="students" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white transition-all">
            <GraduationCap className="w-4 h-4 mr-2" /> Students
          </TabsTrigger>
          <TabsTrigger value="teachers" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white transition-all">
            <Users className="w-4 h-4 mr-2" /> Teachers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="mt-0 outline-none animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
           {/* AdminStudentsPage already has its own gradient header, but as a component it works. */}
           <AdminStudentsPage />
        </TabsContent>

        <TabsContent value="teachers" className="mt-0 outline-none animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
           <EmployeeTeachersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
