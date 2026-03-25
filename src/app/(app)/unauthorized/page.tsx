import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-gray-50/50">
      <div className="flex flex-col items-center space-y-4 text-center">
        <div className="rounded-full bg-red-100 p-4 text-red-600">
          <AlertCircle className="h-10 w-10" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Access Denied</h1>
        <p className="max-w-md text-gray-500">
          You do not have the required permissions or module access to view this page. If you believe this is an error, please contact the administrator.
        </p>
        <div className="pt-4">
          <Button asChild>
            <Link href="/">Return to Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
