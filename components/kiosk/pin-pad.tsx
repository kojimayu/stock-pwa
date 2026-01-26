"use client";

import { Button } from "@/components/ui/button";
import { Delete, Eraser } from "lucide-react";

interface PinPadProps {
    onDigitPress: (digit: string) => void;
    onDeletePress: () => void;
    onClearPress: () => void;
    disabled?: boolean;
}

export function PinPad({ onDigitPress, onDeletePress, onClearPress, disabled }: PinPadProps) {
    const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

    return (
        <div className="grid grid-cols-3 gap-4 w-full max-w-[320px] mx-auto">
            {digits.map((digit) => (
                <Button
                    key={digit}
                    variant="outline"
                    className="h-20 text-3xl font-bold bg-white active:bg-slate-100"
                    onClick={() => onDigitPress(digit)}
                    disabled={disabled}
                >
                    {digit}
                </Button>
            ))}
            <Button
                variant="ghost"
                className="h-20 text-xl text-red-500 font-bold active:bg-slate-100"
                onClick={onClearPress}
                disabled={disabled}
            >
                Clear
            </Button>
            <Button
                variant="outline"
                className="h-20 text-3xl font-bold bg-white active:bg-slate-100"
                onClick={() => onDigitPress("0")}
                disabled={disabled}
            >
                0
            </Button>
            <Button
                variant="ghost"
                className="h-20 active:bg-slate-100"
                onClick={onDeletePress}
                disabled={disabled}
            >
                <Delete className="w-8 h-8" />
            </Button>
        </div>
    );
}
