// src/admin/components/JurorBadge.jsx
// Shared juror identity badge — avatar + name + affiliation.
// Used across all admin pages for consistent juror rendering.
//
// Size/typography is driven entirely by `.jb-badge--{sm|md|lg}` CSS classes
// (see src/styles/components/cards.css). Only per-name colors (hash-based bg/fg)
// remain inline, since they are computed from the juror's name.

import { jurorInitials, jurorAvatarBg, jurorAvatarFg } from "../utils/jurorIdentity";

/**
 * @param {object}  props
 * @param {string}  props.name         - Full juror name (titles stripped automatically)
 * @param {string}  [props.affiliation] - Department / institution
 * @param {string}  [props.avatarUrl]  - URL to juror photo (optional)
 * @param {"sm"|"md"|"lg"} [props.size="md"] - Size variant
 * @param {boolean} [props.nameOnly]   - Only show name, no affiliation
 * @param {object}  [props.style]      - Extra container style
 * @param {string}  [props.className]  - Extra container class
 */
export default function JurorBadge({
  name,
  affiliation,
  avatarUrl,
  size = "md",
  nameOnly = false,
  style,
  className,
}) {
  const displayName = name ? String(name).trim() : "";
  const ini = jurorInitials(name);
  const bg = jurorAvatarBg(name);
  const fg = jurorAvatarFg(name);

  const classes = `jb-badge jb-badge--${size}${className ? ` ${className}` : ""}`;

  return (
    <div className={classes} style={style}>
      {avatarUrl ? (
        <img src={avatarUrl} alt={displayName} className="jb-avatar" />
      ) : (
        <div className="jb-avatar" style={{ background: bg, color: fg }}>
          {ini}
        </div>
      )}
      <div className="jb-info">
        <div className="jb-name">{displayName}</div>
        {!nameOnly && affiliation && (
          <div className="jb-affiliation">{affiliation}</div>
        )}
      </div>
    </div>
  );
}
