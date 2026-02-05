"use client";

import { createBrowserApiClient, apiPost } from "@/lib/api-client";
import { useAuth } from "@clerk/nextjs";
import { ChangeEvent, useMemo, useRef, useState } from "react";
import { Button } from "../ui/button";
import { ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

type ImageUploadBtnProps = {
  onImageUpload: (url: string) => void;
};

function ImageUploadButton({ onImageUpload }: ImageUploadBtnProps) {
  const { getToken } = useAuth();
  const apiClient = useMemo(() => createBrowserApiClient(getToken), [getToken]);

  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function handleClick() {
    inputRef?.current?.click();
  }

  async function handleOnImageFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadedData = await apiClient.post<{ url: string; width: number; height: number }>(
        "/api/upload/image-upload",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      const url: string | undefined = uploadedData.data?.data?.url;

      if (!url) {
        throw new Error("No image url is found");
      }

      onImageUpload(url);

      toast("Image uploaded successfully!", {
        description: "You can now send this image as message!!!",
      });
    } catch (e) {
      console.error("Image upload failed:", e);
      toast.error("Failed to upload image");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleOnImageFileChange}
      />

      <Button
        size="icon"
        variant="ghost"
        type="button"
        onClick={handleClick}
        disabled={uploading}
        className="border-border/40 bg-card/60 text-muted-foreground hover:bg-card/90 hover:text-foreground"
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ImageIcon className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}

export default ImageUploadButton;
