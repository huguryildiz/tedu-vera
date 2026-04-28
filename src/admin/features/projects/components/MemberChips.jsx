import { initials } from "@/shared/ui/avatarColor";
import PremiumTooltip from "@/shared/ui/PremiumTooltip";
import { membersToArray } from "./projectHelpers";

export default function MemberChips({ members }) {
  const arr = membersToArray(members);
  if (!arr.length) {
    return <span className="member-chips member-chips-empty">No team</span>;
  }
  const visible = arr.slice(0, 4);
  const extra = arr.length - visible.length;
  return (
    <span className="member-chips">
      {visible.map((name) => (
        <PremiumTooltip key={name} text={name}>
          <span className="member-chip">
            {initials(name)}
          </span>
        </PremiumTooltip>
      ))}
      {extra > 0 && <span className="member-chip member-chip-more">+{extra}</span>}
    </span>
  );
}
