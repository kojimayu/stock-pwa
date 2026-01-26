"use client";

import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

interface CategoryTabsProps {
    categories: string[];
    selectedCategory: string;
    onSelectCategory: (category: string) => void;
}

export function CategoryTabs({ categories, selectedCategory, onSelectCategory }: CategoryTabsProps) {
    return (
        <ScrollArea className="w-full whitespace-nowrap bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
            <div className="flex w-max p-4 space-x-2">
                <Button
                    variant={selectedCategory === "すべて" ? "default" : "outline"}
                    onClick={() => onSelectCategory("すべて")}
                    className="rounded-full h-10 px-6 font-bold shadow-none"
                >
                    すべて
                </Button>
                {categories.map((category) => (
                    <Button
                        key={category}
                        variant={selectedCategory === category ? "default" : "outline"}
                        onClick={() => onSelectCategory(category)}
                        className="rounded-full h-10 px-6 font-bold shadow-none"
                    >
                        {category}
                    </Button>
                ))}
            </div>
            <ScrollBar orientation="horizontal" className="invisible" />
        </ScrollArea>
    );
}
