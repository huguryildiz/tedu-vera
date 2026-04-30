// src/admin/modals/AvatarUploadModal.jsx
// Avatar photo upload modal — drag-and-drop or browse, JPG only, 200 KB limit.
//
// Props:
//   open       — boolean
//   onClose    — () => void
//   onConfirm  — (file: File, previewUrl: string) => void

import { useCallback, useRef, useState } from "react";
import { ImageIcon, Upload, X } from "lucide-react";
import Modal from "@/shared/ui/Modal";
import FbAlert from "@/shared/ui/FbAlert";

const MAX_KB = 200;
const MAX_BYTES = MAX_KB * 1024;

function readAsDataURL(file) {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = (e) => resolve(e.target.result);
    r.readAsDataURL(file);
  });
}

export default function AvatarUploadModal({ open, onClose, onConfirm }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileError, setFileError] = useState("");

  const reset = () => {
    setPreview(null);
    setSelectedFile(null);
    setFileError("");
    setDragging(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleClose = () => {
    reset();
    onClose?.();
  };

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setFileError("");
    if (!file.type.startsWith("image/jpeg")) {
      setFileError("Only JPG/JPEG images are accepted.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setFileError(`File is too large. Maximum size is ${MAX_KB} KB.`);
      return;
    }
    const url = await readAsDataURL(file);
    setSelectedFile(file);
    setPreview(url);
  }, []);

  const onInputChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    handleFile(file);
  };

  const onDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = (e) => { e.preventDefault(); setDragging(false); };
  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const handleConfirm = () => {
    if (!selectedFile || !preview) return;
    onConfirm?.(selectedFile, preview);
    reset();
    onClose?.();
  };

  return (
    <Modal open={open} onClose={handleClose} size="sm">
      {/* Header */}
      <div className="fs-modal-header">
        <div className="fs-modal-header-row">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="fs-modal-icon accent" style={{ width: 32, height: 32, margin: 0, borderRadius: "var(--radius-sm)" }}>
              <ImageIcon size={15} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3 }}>
                Upload Profile Photo
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                JPG only · Max {MAX_KB} KB
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="fs-close"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="fs-modal-body" style={{ padding: "16px 20px 20px" }}>

        {/* Drop zone */}
        {!preview ? (
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            style={{
              border: `2px dashed ${dragging ? "var(--accent)" : fileError ? "var(--danger)" : "var(--border)"}`,
              borderRadius: "var(--radius)",
              padding: "36px 24px",
              textAlign: "center",
              cursor: "pointer",
              background: dragging
                ? "color-mix(in srgb, var(--accent) 6%, transparent)"
                : fileError
                  ? "color-mix(in srgb, var(--danger) 4%, transparent)"
                  : "var(--surface-1)",
              transition: "border-color .15s, background .15s",
              userSelect: "none",
            }}
          >
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              background: dragging
                ? "color-mix(in srgb, var(--accent) 14%, transparent)"
                : "var(--bg-card)",
              border: "1px solid var(--border)",
              display: "grid", placeItems: "center",
              margin: "0 auto 12px",
              transition: "background .15s",
            }}>
              <Upload
                size={20}
                style={{
                  color: dragging ? "var(--accent)" : "var(--text-tertiary)",
                  transition: "color .15s",
                }}
              />
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
              {dragging ? "Release to upload" : "Drop your photo here"}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>
              or{" "}
              <span
                style={{ color: "var(--accent)", fontWeight: 600, cursor: "pointer" }}
                onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
              >
                browse files
              </span>
            </div>
          </div>
        ) : (
          /* Preview state */
          <div style={{
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            overflow: "hidden",
            position: "relative",
          }}>
            <img
              src={preview}
              alt="Preview"
              style={{ display: "block", width: "100%", maxHeight: 220, objectFit: "cover" }}
            />
            <button
              type="button"
              onClick={reset}
              title="Remove"
              style={{
                position: "absolute", top: 8, right: 8,
                width: 26, height: 26, borderRadius: "50%",
                background: "rgba(0,0,0,0.6)", border: "none",
                display: "grid", placeItems: "center",
                cursor: "pointer", color: "#fff",
              }}
              aria-label="Remove photo"
            >
              <X size={13} />
            </button>
            <div style={{
              padding: "7px 10px",
              background: "var(--surface-1)",
              borderTop: "1px solid var(--border)",
              fontSize: 11,
              color: "var(--text-secondary)",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <ImageIcon size={11} style={{ flexShrink: 0, color: "var(--text-tertiary)" }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {selectedFile?.name}
              </span>
              <span style={{ marginLeft: "auto", flexShrink: 0, color: "var(--text-tertiary)" }}>
                {(selectedFile?.size / 1024).toFixed(0)} KB
              </span>
            </div>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/jpg"
          style={{ display: "none" }}
          onChange={onInputChange}
        />

        {/* Inline error */}
        {fileError && (
          <div style={{ marginTop: 10 }}>
            <FbAlert variant="danger">{fileError}</FbAlert>
          </div>
        )}

        {/* Hint */}
        {!preview && !fileError && (
          <div style={{
            marginTop: 12,
            padding: "8px 12px",
            background: "var(--surface-1)",
            borderRadius: "var(--radius-sm)",
            fontSize: 11,
            color: "var(--text-tertiary)",
            lineHeight: 1.6,
          }}>
            Use a square crop for best results. Portrait photos will be center-cropped on display.
          </div>
        )}

        {/* Footer actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button
            type="button"
            className="fs-btn fs-btn-secondary"
            onClick={handleClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="fs-btn fs-btn-primary"
            onClick={handleConfirm}
            disabled={!selectedFile}
          >
            Apply Photo
          </button>
        </div>
      </div>
    </Modal>
  );
}
