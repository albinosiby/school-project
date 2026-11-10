"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Avatar, Button, Modal } from "@/components/ui";
import { readAdmissionDocument, type AdmissionUpload } from "./admissionDocuments";

type Preview = { status: "loading" } | { status: "unavailable"; message: string } | { status: "ready"; url: string; kind: "image" | "pdf" };

function useAdmissionPreview(path: string): Preview {
  const [result, setResult] = useState<{ path: string; preview: Preview }>();
  useEffect(() => {
    let disposed = false;
    let url: string | undefined;
    void readAdmissionDocument(path).then((file) => {
      if (disposed) return;
      const kind = file.type === "application/pdf" ? "pdf"
        : file.type === "image/png" || file.type === "image/jpeg" ? "image" : null;
      if (!kind) {
        setResult({ path, preview: { status: "unavailable", message: "This file format cannot be previewed." } });
        return;
      }
      url = URL.createObjectURL(file);
      setResult({ path, preview: { status: "ready", url, kind } });
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "The file could not be loaded.";
      if (!disposed) setResult({ path, preview: { status: "unavailable", message } });
    });
    return () => {
      disposed = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [path]);
  return result?.path === path ? result.preview : { status: "loading" };
}

export function StudentPortrait({ name, path }: { name: string; path: string }) {
  const preview = useAdmissionPreview(path);
  const [failedUrl, setFailedUrl] = useState<string>();
  if (preview.status !== "ready" || preview.kind !== "image" || failedUrl === preview.url) {
    return <div className="text-center">
      <Avatar name={name} size={96} />
      <span role="status" className="mt-1 block text-xs text-on-surface-variant">
        {preview.status === "loading" ? "Loading photo…" : "Photo unavailable"}
      </span>
    </div>;
  }
  return <Image unoptimized src={preview.url} width={96} height={96} alt={`Photograph of ${name}`}
    className="size-24 rounded-xl object-cover" onError={() => setFailedUrl(preview.url)} />;
}

export function AdmissionFilePreview({ upload, title, onClose, onDownload, downloading }: {
  upload: AdmissionUpload;
  title: string;
  onClose: () => void;
  onDownload: () => void;
  downloading: boolean;
}) {
  const preview = useAdmissionPreview(upload.path);
  const [failedImage, setFailedImage] = useState<string>();
  return <Modal open title={title} subtitle={upload.name} onClose={onClose} width="max-w-4xl"
    footer={<>
      <Button variant="outline" disabled={downloading} onClick={onDownload}><Download size={16} />Download</Button>
      <Button onClick={onClose}>Done</Button>
    </>}>
    {preview.status === "loading" && <p role="status" className="py-8 text-center text-on-surface-variant">Loading preview…</p>}
    {(preview.status === "unavailable" || (preview.status === "ready" && failedImage === preview.url))
      && <p role="status" className="py-8 text-center text-on-surface-variant">
        {preview.status === "unavailable" ? preview.message : "This image could not be displayed."}
      </p>}
    {preview.status === "ready" && preview.kind === "image" && failedImage !== preview.url &&
      <Image unoptimized src={preview.url} width={1200} height={800} alt={title}
        className="mx-auto block max-h-[60vh] w-auto max-w-full rounded-lg object-contain"
        onError={() => setFailedImage(preview.url)} />}
    {preview.status === "ready" && preview.kind === "pdf" &&
      <iframe src={preview.url} title={title} className="h-[60vh] w-full rounded-lg border border-outline-variant/60" />}
  </Modal>;
}
