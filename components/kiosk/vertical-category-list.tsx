"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface VerticalCategoryListProps {
    categories: string[];
    selectedCategory: string;
    onSelectCategory: (category: string) => void;
    className?: string;
}

export function VerticalCategoryList({ categories, selectedCategory, onSelectCategory, className }: VerticalCategoryListProps) {
    return (
        <ScrollArea className={cn("h-full", className)}>
            <div className="flex flex-col space-y-1 p-2">
                <button
                    onClick={() => onSelectCategory("すべて")}
                    className={cn(
                        "text-left px-4 py-3 rounded-lg text-sm font-bold transition-colors w-full",
                        selectedCategory === "すべて"
                            ? "bg-slate-900 text-white shadow-sm"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    )}
                >
                    すべて
                </button>
                {categories.map((category) => (
                    <button
                        key={category}
                        onClick={() => onSelectCategory(category)}
                        className={cn(
                            "text-left px-4 py-3 rounded-lg text-sm font-bold transition-colors w-full",
                            selectedCategory === category
                                ? "bg-slate-900 text-white shadow-sm"
                                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        )}
                    >
                        {category}
                    </button>
                ))}
            </div>
        </ScrollArea>
    );
}
