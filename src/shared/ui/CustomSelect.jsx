import { useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { useFloating } from "../hooks/useFloating";

export default function CustomSelect({
  id,
  value,
  onChange,
  options = [],
  placeholder = "Select…",
  disabled = false,
  ariaLabel,
  className = "",
  wrapperClassName = "",
  triggerClassName = "",
  menuClassName = "",
  compact = false,
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);

  const handleClose = useCallback(() => setOpen(false), []);

  const { floatingRef, floatingStyle } = useFloating({
    triggerRef,
    isOpen: open,
    onClose: handleClose,
    placement: "bottom-start",
    offset: 4,
    zIndex: "var(--z-modal-dropdown)",
  });

  const selectedLabel = useMemo(() => {
    const selected = options.find((opt) => String(opt.value) === String(value));
    return selected?.label ?? placeholder;
  }, [options, value, placeholder]);

  return (
    <div
      className={`custom-select${compact ? " compact" : ""}${disabled ? " disabled" : ""}${wrapperClassName ? ` ${wrapperClassName}` : ""}`}
    >
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={`filter-dropdown-trigger custom-select-trigger${open ? " open" : ""}${className ? ` ${className}` : ""}${triggerClassName ? ` ${triggerClassName}` : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="custom-select-label">{selectedLabel}</span>
        <ChevronDown size={16} />
      </button>

      {open && createPortal(
        <div
          ref={floatingRef}
          className={`filter-dropdown-menu custom-select-menu${menuClassName ? ` ${menuClassName}` : ""}`}
          style={{ ...floatingStyle, minWidth: triggerRef.current?.getBoundingClientRect().width ?? 'auto' }}
          role="listbox"
          aria-label={ariaLabel}
        >
          {options.map((opt) => {
            const optValue = String(opt.value);
            const selected = String(value) === optValue;
            return (
              <div
                key={optValue}
                role="option"
                aria-selected={selected}
                className={`filter-dropdown-option${selected ? " selected" : ""}${opt.disabled ? " disabled" : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (opt.disabled) return;
                  onChange?.(opt.value);
                  setOpen(false);
                }}
              >
                {opt.label}
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
