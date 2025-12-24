"use client";

import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function SignOutButton() {
    const router = useRouter();

    const handleSignOut = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/login"); // Client-side redirect
        router.refresh(); // Refresh to clear server context
    };

    return (
        <Button variant="ghost" size="sm" onClick={handleSignOut} title="登出">
            <LogOut className="h-4 w-4 mr-2" />
            登出
        </Button>
    );
}
