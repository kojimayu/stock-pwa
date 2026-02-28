"use client";

import { useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Upload, X } from "lucide-react";
import { compressImages } from "@/lib/image-utils";

type Props = {
    photos: File[];
    onChange: (photos: File[]) => void;
    label?: string;
};

/**
 * 写真入力コンポーネント（ドラッグ&ドロップ + タップ撮影/選択 + 複数枚対応）
 * - PC: ドラッグ&ドロップでファイルを追加
 * - モバイル: タップでカメラ撮影/ファイル選択
 * - 自動圧縮（最大1920px、JPEG 0.82品質）
 */
export function PhotoDropzone({ photos, onChange, label = "納品伝票写真" }: Props) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const addFiles = useCallback(async (files: File[]) => {
        const imageFiles = files.filter(f => f.type.startsWith("image/"));
        if (imageFiles.length === 0) return;
        const compressed = await compressImages(imageFiles);
        onChange([...photos, ...compressed]);
    }, [photos, onChange]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files);
        addFiles(files);
    }, [addFiles]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        await addFiles(files);
        // input をリセット（同じファイルの再選択を許可）
        e.target.value = "";
    }, [addFiles]);

    const removePhoto = useCallback((index: number) => {
        onChange(photos.filter((_, i) => i !== index));
    }, [photos, onChange]);

    return (
        <div className="space-y-2">
            <label className="text-xs font-medium text-slate-600 block">
                {label}（複数枚OK・ドラッグ&ドロップ対応）
            </label>

            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={handleFileInput}
                className="hidden"
            />

            {/* プレビュー + ドロップゾーン */}
            <div
                className={`
                    relative border-2 border-dashed rounded-lg p-3 transition-colors
                    ${isDragging
                        ? "border-blue-500 bg-blue-50"
                        : photos.length > 0
                            ? "border-slate-200 bg-white"
                            : "border-slate-300 bg-slate-50/50"
                    }
                `}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
            >
                {photos.length > 0 ? (
                    <div className="space-y-2">
                        <div className="flex gap-2 flex-wrap">
                            {photos.map((f, i) => (
                                <div key={i} className="relative group">
                                    <img
                                        src={URL.createObjectURL(f)}
                                        alt={`写真${i + 1}`}
                                        className="w-20 h-20 object-cover rounded border"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removePhoto(i)}
                                        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-80 hover:opacity-100 transition-opacity"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] text-center py-0.5 rounded-b">
                                        {(f.size / 1024).toFixed(0)}KB
                                    </div>
                                </div>
                            ))}
                            {/* 追加ボタン */}
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="w-20 h-20 border-2 border-dashed border-slate-300 rounded flex flex-col items-center justify-center text-slate-400 hover:text-slate-600 hover:border-slate-400 transition-colors"
                            >
                                <Upload className="h-5 w-5" />
                                <span className="text-[10px] mt-0.5">追加</span>
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full flex flex-col items-center justify-center py-4 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <div className="flex items-center gap-3 mb-1">
                            <Camera className="h-5 w-5" />
                            <Upload className="h-5 w-5" />
                        </div>
                        <span className="text-sm">
                            {isDragging ? "ドロップして追加" : "タップして撮影 / ドラッグ&ドロップ"}
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5">
                            自動圧縮・複数枚対応
                        </span>
                    </button>
                )}

                {/* ドラッグ中のオーバーレイ */}
                {isDragging && (
                    <div className="absolute inset-0 bg-blue-100/80 border-2 border-blue-500 rounded-lg flex items-center justify-center pointer-events-none">
                        <div className="text-blue-600 font-medium text-sm flex items-center gap-2">
                            <Upload className="h-5 w-5" />
                            ドロップして追加
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
