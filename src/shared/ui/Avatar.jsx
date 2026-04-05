// src/shared/ui/Avatar.jsx
// Shared avatar primitive — shows photo when avatarUrl is set, initials otherwise.
//
// Props:
//   avatarUrl   — string | null   photo URL
//   initials    — string          fallback text (e.g. "DA")
//   bg          — string          CSS color for initials background
//   size        — number          diameter in px (default 36)
//   fontSize    — number          initials font size (default auto: size * 0.37)
//   className   — string
//   style       — object

export default function Avatar({ avatarUrl, initials, bg, size = 36, fontSize, className = "", style = {} }) {
  const fs = fontSize ?? Math.round(size * 0.37);
  const base = {
    width: size,
    height: size,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    overflow: "hidden",
    fontSize: fs,
    fontWeight: 700,
    background: avatarUrl ? "transparent" : (bg || "#6366f1"),
    color: "#fff",
    ...style,
  };

  return (
    <div className={className} style={base} aria-hidden="true">
      {avatarUrl
        ? <img src={avatarUrl} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        : (initials || "?")}
    </div>
  );
}
