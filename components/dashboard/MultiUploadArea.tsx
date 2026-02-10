"use client";

import { useState, useCallback, useEffect } from "react";
import { useDropzone, FileRejection, DropEvent } from "react-dropzone";

type MultiUploadAreaProps = {
    onFilesChange: (files: File[]) => void;
    title?: string;
    subTitle?: string;
    accept?: Record<string, string[]>;
    maxFiles?: number;
};

// Client-side image resizing helper
const resizeImage = (file: File, maxDimension: number = 1500): Promise<File> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                // Calculate new dimensions
                if (width > height) {
                    if (width > maxDimension) {
                        height = Math.round((height * maxDimension) / width);
                        width = maxDimension;
                    }
                } else {
                    if (height > maxDimension) {
                        width = Math.round((width * maxDimension) / height);
                        height = maxDimension;
                    }
                }

                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx?.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    if (blob) {
                        // Create new file with resized content
                        const resizedFile = new File([blob], file.name, {
                            type: file.type,
                            lastModified: Date.now(),
                        });
                        resolve(resizedFile);
                    } else {
                        reject(new Error("Canvas to Blob conversion failed"));
                    }
                }, file.type, 0.85); // 0.85 quality for JPEG/WebP
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
};

export default function MultiUploadArea({
    onFilesChange,
    title = "Drop files here",
    subTitle = "Support for multiple pages",
    accept = { "image/*": [] },
    maxFiles = 10,
}: MultiUploadAreaProps) {
    const [files, setFiles] = useState<File[]>([]);
    const [isResizing, setIsResizing] = useState(false);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        setIsResizing(true);
        try {
            // Process all files in parallel
            const resizedFiles = await Promise.all(
                acceptedFiles.map(file => resizeImage(file))
            );

            setFiles(prev => {
                const newFiles = [...prev, ...resizedFiles];
                return newFiles;
            });
        } catch (error) {
            console.error("Resizing error:", error);
            alert("Failed to process some images.");
        } finally {
            setIsResizing(false);
        }
    }, []);

    // Notify parent when files change (Fixed: Avoid setState during render)
    useEffect(() => {
        onFilesChange(files);
    }, [files, onFilesChange]);

    const removeFile = (indexToRemove: number) => {
        setFiles(prev => {
            const newFiles = prev.filter((_, i) => i !== indexToRemove);
            return newFiles;
        });
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept,
        maxFiles,
    });

    return (
        <div className="w-full space-y-4">
            {/* Drop Zone */}
            <div
                {...getRootProps()}
                className={`
                    w-full min-h-[120px] rounded-xl border-2 border-dashed transition-all duration-300 cursor-pointer
                    flex flex-col items-center justify-center p-4
                    ${isDragActive
                        ? "border-blue-500 bg-blue-50 scale-[1.02]"
                        : "border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100"
                    }
                `}
            >
                <input {...getInputProps()} />
                <div className="text-center">
                    <div className="w-10 h-10 bg-white rounded-full mx-auto mb-2 flex items-center justify-center shadow-sm text-gray-400">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                    </div>
                    <p className="text-gray-900 font-medium text-sm">{title}</p>
                    <p className="text-gray-500 text-xs mt-1">{subTitle}</p>
                    {isResizing && <p className="text-blue-500 text-xs mt-2 animate-pulse">画像を処理中...</p>}
                </div>
            </div>

            {/* Thumbnails Grid */}
            {files.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                    {files.map((file, idx) => (
                        <div key={`${file.name}-${idx}`} className="relative group aspect-[3/4]">
                            <img
                                src={URL.createObjectURL(file)}
                                alt={`preview-${idx}`}
                                className="w-full h-full object-cover rounded-lg border border-gray-200 shadow-sm"
                            />
                            {/* Remove Button */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removeFile(idx);
                                }}
                                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                            >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                            {/* Page Number Badge */}
                            <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-full backdrop-blur-sm">
                                p.{idx + 1}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
