"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export function SidebarNav() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const sectionParam = searchParams.get('section');

    const links = [
        { href: "/dashboard", label: "Dashboard", exact: true },
        { href: "/favorites", label: "My Favorites", exact: true },
        { href: "/indicators", label: "指標管理 (Indicators)" },
        { href: "/elements", label: "要素管理 (Factors)" },
        { href: "/settings/valuesets", label: "專有名詞管理" },
        { href: "/dashboard/settings", label: "Settings" },
    ];

    return (
        <nav className="flex flex-col space-y-2">
            {links.map((link) => {
                let isActive = link.exact
                    ? pathname === link.href
                    : pathname.startsWith(link.href) && link.href !== "#";

                // Special logic: If in 'indicators' but 'section' param exists, highlight Factors instead
                if (link.href === '/elements' && pathname.startsWith('/indicators') && sectionParam) {
                    isActive = true;
                }
                if (link.href === '/indicators' && pathname.startsWith('/indicators') && sectionParam) {
                    isActive = false;
                }

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
