
"use client";

import { useState, useMemo } from "react";
import { ChevronRight, ChevronDown, Check } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Product } from "@/lib/types";

interface MergedCategoryListProps {
    products: Product[];
    selectedCategory: string | null;
    selectedSubCategory: string | null;
    selectedProductType: string | null;
    onSelectCategory: (category: string | null) => void;
    onSelectSubCategory: (subCategory: string | null) => void;
    onSelectProductType: (productType: string | null) => void;
    className?: string;
}

interface CategoryTree {
    [category: string]: {
        [subCategory: string]: Set<string>; // Set of productTypes
    };
}

export function MergedCategoryList({
    products,
    selectedCategory,
    selectedSubCategory,
    selectedProductType,
    onSelectCategory,
    onSelectSubCategory,
    onSelectProductType,
    className
}: MergedCategoryListProps) {
    // Build the tree structure dynamically from products
    const tree = useMemo(() => {
        const t: CategoryTree = {};
        products.forEach(p => {
            if (!p.category) return;
            if (!t[p.category]) t[p.category] = {};

            const sub = p.subCategory || "その他";
            if (!t[p.category][sub]) t[p.category][sub] = new Set();

            if (p.productType) {
                t[p.category][sub].add(p.productType);
            }
        });
        return t;
    }, [products]);

    // Categories (Large)
    const categories = Object.keys(tree).sort();

    return (
        <div className={cn("flex flex-col h-full bg-slate-50 border-r", className)}>
            <div className="p-4 font-bold text-slate-700 border-b bg-white">
                カテゴリー
            </div>
            <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                    <button
                        onClick={() => {
                            onSelectCategory(null);
                            onSelectSubCategory(null);
                            onSelectProductType(null);
                        }}
                        className={cn(
                            "w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                            !selectedCategory
                                ? "bg-blue-100 text-blue-700"
                                : "text-slate-600 hover:bg-slate-100"
                        )}
                    >
                        全ての商品
                    </button>

                    {categories.map(cat => (
                        <CategoryItem
                            key={cat}
                            label={cat}
                            isSelected={selectedCategory === cat}
                            onSelect={() => {
                                if (selectedCategory === cat) {
                                    // Deselect? No, usually just keep selected or toggle expansion?
                                    // For this UI, selecting a category filters by it.
                                    // If already selected, maybe do nothing or toggle accordion?
                                    // Let's assume selection implies expansion.
                                } else {
                                    onSelectCategory(cat);
                                    onSelectSubCategory(null);
                                    onSelectProductType(null);
                                }
                            }}
                            subCategories={tree[cat]}
                            selectedSubCategory={selectedSubCategory}
                            selectedProductType={selectedProductType}
                            onSelectSubCategory={onSelectSubCategory}
                            onSelectProductType={onSelectProductType}
                        />
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}

function CategoryItem({
    label,
    isSelected,
    onSelect,
    subCategories,
    selectedSubCategory,
    selectedProductType,
    onSelectSubCategory,
    onSelectProductType
}: {
    label: string,
    isSelected: boolean,
    onSelect: () => void,
    subCategories: { [sub: string]: Set<string> },
    selectedSubCategory: string | null,
    selectedProductType: string | null,
    onSelectSubCategory: (s: string | null) => void,
    onSelectProductType: (t: string | null) => void
}) {
    const subCats = Object.keys(subCategories).sort();

    return (
        <div className="space-y-1">
            <button
                onClick={onSelect}
                className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    isSelected
                        ? "bg-white text-blue-600 shadow-sm ring-1 ring-blue-100"
                        : "text-slate-600 hover:bg-slate-100"
                )}
            >
                <span>{label}</span>
                {isSelected && <ChevronDown className="w-4 h-4 opacity-50" />}
                {!isSelected && <ChevronRight className="w-4 h-4 opacity-30" />}
            </button>

            {isSelected && (
                <div className="ml-3 pl-3 border-l-2 border-slate-100 space-y-1">
                    {subCats.map(sub => (
                        <SubCategoryItem
                            key={sub}
                            label={sub}
                            isSelected={selectedSubCategory === sub}
                            onSelect={() => {
                                onSelectSubCategory(sub === selectedSubCategory ? null : sub);
                                onSelectProductType(null);
                            }}
                            productTypes={Array.from(subCategories[sub]).sort()}
                            selectedProductType={selectedProductType}
                            onSelectProductType={onSelectProductType}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function SubCategoryItem({
    label,
    isSelected,
    onSelect,
    productTypes,
    selectedProductType,
    onSelectProductType
}: {
    label: string,
    isSelected: boolean,
    onSelect: () => void,
    productTypes: string[],
    selectedProductType: string | null,
    onSelectProductType: (t: string | null) => void
}) {
    return (
        <div className="space-y-1">
            <button
                onClick={onSelect}
                className={cn(
                    "w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors flex items-center justify-between",
                    isSelected
                        ? "text-blue-600 font-semibold bg-blue-50"
                        : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                )}
            >
                {label}
            </button>

            {isSelected && productTypes.length > 0 && (
                <div className="ml-2 pl-2 border-l border-slate-200 mt-1 space-y-0.5">
                    {productTypes.map(type => (
                        <button
                            key={type}
                            onClick={() => onSelectProductType(type === selectedProductType ? null : type)}
                            className={cn(
                                "w-full text-left px-2 py-1 rounded text-xs transition-colors flex items-center gap-2",
                                selectedProductType === type
                                    ? "text-blue-600 font-medium bg-blue-50"
                                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                            )}
                        >
                            <div className={cn("w-1.5 h-1.5 rounded-full", selectedProductType === type ? "bg-blue-500" : "bg-slate-300")} />
                            {type}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
