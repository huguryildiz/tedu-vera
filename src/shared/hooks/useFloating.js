import { useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';

/**
 * useFloating — shared positioning hook for all floating panels in VERA.
 *
 * On scroll, panels reposition to follow their trigger (standard floating UI
 * behavior). Pass closeOnScroll: true for the legacy "close when any scroll
 * happens" behavior.
 *
 * @param {object} options
 * @param {React.RefObject} options.triggerRef   - ref attached to the element that opens the panel
 * @param {boolean}         options.isOpen       - controlled open state
 * @param {function}        options.onClose      - called when the panel should close
 * @param {'bottom-start'|'bottom-end'|'top-start'|'top-end'} [options.placement='bottom-start']
 * @param {number}          [options.offset=4]   - gap between trigger and panel in px
 * @param {boolean}         [options.closeOnScroll=false] - legacy: close on any scroll
 * @param {string|number}   [options.zIndex='var(--z-dropdown)']
 *
 * @returns {{ floatingRef: React.RefObject, floatingStyle: object, updatePosition: function, actualPlacement: string }}
 */
export function useFloating({
  triggerRef,
  isOpen,
  onClose,
  placement = 'bottom-start',
  offset = 4,
  closeOnScroll = false,
  zIndex = 'var(--z-dropdown)',
}) {
  const floatingRef = useRef(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, placement });

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !floatingRef.current) return;

    const trigger = triggerRef.current.getBoundingClientRect();
    const panel = floatingRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Determine vertical side
    let vertical = placement.startsWith('top') ? 'top' : 'bottom';
    // Flip if insufficient space
    if (vertical === 'bottom' && trigger.bottom + offset + panel.height > vh) {
      vertical = 'top';
    } else if (vertical === 'top' && trigger.top - offset - panel.height < 0) {
      vertical = 'bottom';
    }

    // Determine horizontal alignment
    let horizontal = placement.endsWith('end') ? 'end' : 'start';
    // Flip if overflows right
    if (horizontal === 'start' && trigger.left + panel.width > vw) {
      horizontal = 'end';
    } else if (horizontal === 'end' && trigger.right - panel.width < 0) {
      horizontal = 'start';
    }

    const top =
      vertical === 'bottom'
        ? trigger.bottom + offset
        : trigger.top - panel.height - offset;

    const left =
      horizontal === 'start'
        ? trigger.left
        : trigger.right - panel.width;

    setCoords({ top, left, placement: `${vertical}-${horizontal}` });
  }, [triggerRef, placement, offset]);

  // Position synchronously before paint when opening
  useLayoutEffect(() => {
    if (isOpen) {
      // First render: panel has no size yet; run once in next frame for accurate rect
      requestAnimationFrame(updatePosition);
    }
  }, [isOpen, updatePosition]);

  // Resize listener
  useEffect(() => {
    if (!isOpen) return;
    const onResize = () => updatePosition();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isOpen, updatePosition]);

  // Scroll: reposition to follow trigger (default) or close (opt-in legacy)
  useEffect(() => {
    if (!isOpen) return;
    const onScroll = closeOnScroll ? () => onClose() : () => updatePosition();
    window.addEventListener('scroll', onScroll, true); // capture = catches all scroll events
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [isOpen, closeOnScroll, onClose, updatePosition]);

  // Outside click
  useEffect(() => {
    if (!isOpen) return;
    const onMouseDown = (e) => {
      if (
        floatingRef.current && !floatingRef.current.contains(e.target) &&
        triggerRef.current && !triggerRef.current.contains(e.target)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [isOpen, onClose, triggerRef]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const floatingStyle = {
    position: 'fixed',
    top: coords.top,
    left: coords.left,
    zIndex,
  };

  return { floatingRef, floatingStyle, updatePosition, actualPlacement: coords.placement };
}
