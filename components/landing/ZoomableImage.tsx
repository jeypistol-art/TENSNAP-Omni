"use client";

import { useState } from "react";
import Image from "next/image";
import { X, ZoomIn } from "lucide-react";

interface ZoomableImageProps {
    src: string;
    alt: string;
    width: number;
    height: number;
    className?: string;
}

export function ZoomableImage({ src, alt, width, height, className }: ZoomableImageProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <div
                className={`relative cursor-pointer group flex items-center justify-center ${className || ""}`}
                onClick={() => setIsOpen(true)}
            >
                <Image
                    src={src}
                    alt={alt}
                    width={width}
                    height={height}
                    className="w-full h-full object-contain rounded-xl transition-transform duration-300 group-hover:scale-[1.02]"
                />
                <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center pointer-events-none">
                    <span className="bg-black/70 text-white px-4 py-2 rounded-full text-sm font-bold backdrop-blur-sm shadow-lg flex items-center gap-2">
                        <ZoomIn className="w-4 h-4" />
                        クリックして拡大
                    </span>
                </div>
            </div>

            {isOpen && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
                    onClick={() => setIsOpen(false)}
                >
                    <button
                        className="absolute top-6 right-6 text-white hover:text-gray-300 bg-black/50 hover:bg-black/70 rounded-full p-2 transition-colors z-[101]"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsOpen(false);
                        }}
                        aria-label="閉じる"
                    >
                        <X className="w-8 h-8" />
                    </button>
                    <div
                        className="relative w-full h-full max-w-5xl max-h-[90vh] animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Image
                            src={src}
                            alt={alt}
                            fill
                            className="object-contain"
                            sizes="100vw"
                            priority
                        />
                    </div>
                </div>
            )}
        </>
    );
}
