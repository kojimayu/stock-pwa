"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface VerticalSubCategoryListProps {
    subCategories: string[];
    selectedSubCategory: string;
    onSelectSubCategory: (category: string) => void;
    className?: string;
}

export function VerticalSubCategoryList({ subCategories, selectedSubCategory, onSelectSubCategory, className }: VerticalSubCategoryListProps) {
    if (subCategories.length === 0) {
        return (
            <div className={cn("h-full py-4 text-center text-slate-400 text-sm", className)}>
                サブカテゴリなし
            </div>
        );
    }

    return (
        <ScrollArea className={cn("h-full", className)}>
            <div className="flex flex-col space-y-1 p-2">
                <button
                    onClick={() => onSelectSubCategory("すべて")}
                    className={cn(
                        "text-left px-4 py-2 rounded-lg text-sm font-bold transition-colors w-full",
                        selectedSubCategory === "すべて"
                            ? "bg-slate-200 text-slate-900 border border-slate-300"
                            : "text-slate-500 hover:bg-slate-100"
                    )}
                >
                    すべて
                </button>
                {subCategories.map((category) => (
                    <button
                        key={category}
                        onClick={() => onSelectSubCategory(category)}
                        className={cn(
                            "text-left px-4 py-2 rounded-lg text-sm font-bold transition-colors w-full",
                            selectedSubCategory === category
                                ? "bg-slate-200 text-slate-900 border border-slate-300"
                                : "text-slate-500 hover:bg-slate-100"
                        )}
                    >
                        {category}
                    </button>
                ))}
            </div>
        </ScrollArea>
    );
}
