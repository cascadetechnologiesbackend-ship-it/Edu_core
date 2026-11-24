"use client";

import React, { useRef } from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { Camera, Loader2, User } from "lucide-react";
import { cn, getInitials } from "@/lib/utils";

export interface AvatarProps {
  src?: string | null | undefined;
  name?: string | null | undefined;
  size?: "sm" | "md" | "lg" | "xl" | undefined;
  shape?: "circle" | "squircle" | undefined;
  className?: string | undefined;
  canMutate?: boolean | undefined;
  canEdit?: boolean | undefined;
  isUploading?: boolean | undefined;
  isLoading?: boolean | undefined;
  onUpload?: ((file: File) => void | Promise<void>) | undefined;
  onPhotoSelected?: ((file: File) => void | Promise<void>) | undefined;
  onRemove?: (() => void | Promise<void>) | undefined;
  onPhotoRemoved?: (() => void | Promise<void>) | undefined;
}

const SIZE_MAP = {
  sm: {
    container: "h-8 w-8 rounded-xl",
    text: "text-xs font-bold",
    iconSize: "w-3 h-3",
  },
  md: {
    container: "h-11 w-11 sm:h-12 sm:w-12 rounded-2xl",
    text: "text-sm font-bold",
    iconSize: "w-3.5 h-3.5",
  },
  lg: {
    container: "h-14 w-14 sm:h-16 sm:w-16 rounded-2xl",
    text: "text-base font-extrabold",
    iconSize: "w-4 h-4",
  },
  xl: {
    container: "h-20 w-20 sm:h-24 sm:w-24 rounded-3xl",
    text: "text-2xl font-extrabold",
    iconSize: "w-5 h-5",
  },
};

// Deterministic neutral system grays for monogram fallback (Apple HIG: Identity is not status)
const NEUTRAL_FALLBACK_CLASSES = [
  "bg-muted/80 text-foreground",
  "bg-muted text-foreground",
  "bg-muted/90 text-foreground",
  "bg-muted/70 text-foreground",
];

function getNeutralFallbackColor(name: string = ""): string {
  if (!name) return NEUTRAL_FALLBACK_CLASSES[0] as string;
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % NEUTRAL_FALLBACK_CLASSES.length;
  return (NEUTRAL_FALLBACK_CLASSES[index] || NEUTRAL_FALLBACK_CLASSES[0]) as string;
}

export function Avatar({
  src,
  name = "",
  size = "md",
  shape = "squircle",
  className,
  canMutate,
  canEdit,
  isUploading,
  isLoading,
  onUpload,
  onPhotoSelected,
  onRemove,
  onPhotoRemoved,
}: AvatarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const allowMutate = Boolean(canMutate ?? canEdit);
  const uploading = Boolean(isUploading ?? isLoading);
  const handleUpload = onUpload ?? onPhotoSelected;
  const handleRemove = onRemove ?? onPhotoRemoved;
  const sizeStyles = SIZE_MAP[size] || SIZE_MAP.md;
  const initials = name && name !== "Name not recorded" && name !== "Unknown" ? getInitials(name) : null;
  const neutralColor = getNeutralFallbackColor(name || "");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && handleUpload) {
      handleUpload(file);
    }
    // Reset value so same file can be re-selected if needed
    e.target.value = "";
  };

  return (
    <div className="relative group inline-block flex-shrink-0">
      <AvatarPrimitive.Root
        className={cn(
          "relative flex shrink-0 overflow-hidden shadow-level-1 border border-border/40 select-none bg-muted/40",
          sizeStyles.container,
          className
        )}
      >
        {src ? (
          <AvatarPrimitive.Image
            src={src}
            alt={name || "User Avatar"}
            className="aspect-square h-full w-full object-cover"
          />
        ) : null}
        <AvatarPrimitive.Fallback
          className={cn(
            "flex h-full w-full items-center justify-center tracking-tight",
            sizeStyles.text,
            neutralColor
          )}
        >
          {initials ? initials : <User className={sizeStyles.iconSize} />}
        </AvatarPrimitive.Fallback>
      </AvatarPrimitive.Root>

      {/* Upload/Replace affordance under allowMutate authority */}
      {allowMutate && handleUpload && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleFileChange}
            disabled={uploading}
          />
          <button
            type="button"
            title="Update photo"
            aria-label="Update photo"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="absolute -bottom-1 -right-1 p-1 rounded-full bg-card hover:bg-muted text-foreground border border-border/60 shadow-sm transition-all duration-150 hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-semantic-interactive" />
            ) : (
              <Camera className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
            )}
          </button>
        </>
      )}
    </div>
  );
}
