"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function SidebarNav() {
    const pathname = usePathname();

    const links = [
        { href: "/dashboard", label: "Dashboard", exact: true },
        { href: "/favorites", label: "My Favorites", exact: true },
        { href: "#", label: "Messages" },
        { href: "/dashboard/settings", label: "Settings" },
    ];

    return (
        <nav className="flex flex-col space-y-2">
            {links.map((link) => {
                const isActive = link.exact
                    ? pathname === link.href
                    : pathname.startsWith(link.href) && link.href !== "#";

                return (
                    <Link
                        key={link.label}
                        href={link.href}
                        className={cn(
                            "p-2 rounded hover:bg-muted font-medium transition-colors",
                            isActive
                                ? "text-black font-bold bg-muted/50"
                                : "text-muted-foreground"
                        )}
                    >
                        {link.label}
                    </Link>
                );
            })}
        </nav>
    );
}
