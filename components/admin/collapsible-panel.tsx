"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

export function CollapsiblePanel({
    title,
    icon,
    defaultOpen = false,
    children,
    className = "",
}: {
    title: ReactNode;
    icon?: ReactNode;
    defaultOpen?: boolean;
    children: ReactNode;
    className?: string;
}) {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <div className={`border rounded-lg ${className}`}>
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="flex items-center gap-2 w-full p-4 text-left hover:bg-slate-50/50 transition-colors"
            >
                {icon}
                <span className="text-sm font-semibold flex-1">{title}</span>
                {open ? (
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                )}
            </button>
            {open && (
                <div className="px-4 pb-4 -mt-1">
                    {children}
                </div>
            )}
        </div>
    );
}
