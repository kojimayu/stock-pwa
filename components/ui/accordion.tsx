"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

// Simple Context Mock
const Context = React.createContext<any>({ openItem: '', setOpenItem: () => { } });
const ItemContext = React.createContext<string>('');

const Accordion = React.forwardRef<
    HTMLDivElement,
    React.ComponentPropsWithoutRef<"div"> & { type?: "single" | "multiple"; collapsible?: boolean }
>(({ className, children, ...props }, ref) => {
    const [openItem, setOpenItem] = React.useState('');

    return (
        <Context.Provider value={{ openItem, setOpenItem }}>
            <div ref={ref} className={cn("space-y-1", className)} {...props}>
                {children}
            </div>
        </Context.Provider>
    )
})
Accordion.displayName = "Accordion"

const AccordionItem = React.forwardRef<
    HTMLDivElement,
    React.ComponentPropsWithoutRef<"div"> & { value: string }
>(({ className, value, children, ...props }, ref) => (
    <ItemContext.Provider value={value}>
        <div ref={ref} className={cn("border-b", className)} {...props}>
            {children}
        </div>
    </ItemContext.Provider>
))
AccordionItem.displayName = "AccordionItem"

const AccordionTrigger = React.forwardRef<
    HTMLButtonElement,
    React.ComponentPropsWithoutRef<"button">
>(({ className, children, ...props }, ref) => {
    const value = React.useContext(ItemContext);
    const { openItem, setOpenItem } = React.useContext(Context);
    const isOpen = openItem === value;

    return (
        <button
            ref={ref}
            type="button" // Prevent form submission
            onClick={() => setOpenItem(isOpen ? '' : value)}
            className={cn(
                "flex flex-1 items-center justify-between py-4 font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180",
                className
            )}
            {...props}
            data-state={isOpen ? 'open' : 'closed'}
        >
            {children}
            <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
        </button>
    )
})
AccordionTrigger.displayName = "AccordionTrigger"

const AccordionContent = React.forwardRef<
    HTMLDivElement,
    React.ComponentPropsWithoutRef<"div">
>(({ className, children, ...props }, ref) => {
    const value = React.useContext(ItemContext);
    const { openItem } = React.useContext(Context);
    const isOpen = openItem === value;

    if (!isOpen) return null;

    return (
        <div
            ref={ref}
            className={cn(
                "overflow-hidden text-sm transition-all animate-in fade-in zoom-in-95",
                className
            )}
            {...props}
        >
            <div className="pb-4 pt-0">{children}</div>
        </div>
    )
})
AccordionContent.displayName = "AccordionContent"

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
