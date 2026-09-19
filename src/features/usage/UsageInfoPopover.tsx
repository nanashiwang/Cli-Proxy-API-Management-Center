import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { IconInfo } from '@/components/ui/icons';
import styles from './UsageInfoPopover.module.scss';

export function UsageInfoPopover({
  label,
  children,
  width = 326,
}: {
  label: string;
  children: ReactNode;
  width?: number;
}) {
  const tooltipId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const pinned = useRef(false);
  const suppressHover = useRef(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({ visibility: 'hidden' });
  const cancelLeave = () => {
    if (leaveTimer.current !== null) clearTimeout(leaveTimer.current);
    leaveTimer.current = null;
  };
  const preview = () => {
    cancelLeave();
    document.dispatchEvent(new CustomEvent('usage-info-open', { detail: tooltipId }));
    setOpen(true);
  };
  const leave = () => {
    cancelLeave();
    if (pinned.current || document.activeElement === trigger.current) return;
    leaveTimer.current = setTimeout(() => setOpen(false), 150);
  };

  useEffect(
    () => () => {
      if (leaveTimer.current !== null) clearTimeout(leaveTimer.current);
    },
    []
  );

  useEffect(() => {
    const closeOther = (event: Event) => {
      if ((event as CustomEvent<string>).detail === tooltipId) return;
      pinned.current = false;
      setOpen(false);
    };
    document.addEventListener('usage-info-open', closeOther);
    return () => document.removeEventListener('usage-info-open', closeOther);
  }, [tooltipId]);

  useEffect(() => {
    if (!open) return;
    const dismiss = () => {
      pinned.current = false;
      setOpen(false);
    };
    const outside = (event: PointerEvent) => {
      if (
        trigger.current?.contains(event.target as Node) ||
        popup.current?.contains(event.target as Node)
      )
        return;
      dismiss();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        suppressHover.current = true;
        dismiss();
      }
    };
    const scroll = (event: Event) => {
      if (!popup.current?.contains(event.target as Node)) dismiss();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    window.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', dismiss);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('scroll', scroll, true);
      window.removeEventListener('resize', dismiss);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !trigger.current || !popup.current) return;
    const anchor = trigger.current.getBoundingClientRect();
    const panel = popup.current.getBoundingClientRect();
    const margin = 12;
    const below = anchor.bottom + 8;
    const above = anchor.top - panel.height - 8;
    setPosition({
      left: Math.max(
        margin,
        Math.min(anchor.right - panel.width, window.innerWidth - panel.width - margin)
      ),
      top: Math.max(
        margin,
        Math.min(
          below + panel.height <= window.innerHeight - margin ? below : above,
          window.innerHeight - panel.height - margin
        )
      ),
    });
  }, [open, label, width]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={styles.info}
        aria-label={label}
        data-usage-info
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        onPointerEnter={(event) => {
          const focusedInfo = document.activeElement?.closest('[data-usage-info]');
          if (
            event.pointerType === 'mouse' &&
            !suppressHover.current &&
            (!focusedInfo || focusedInfo === trigger.current)
          )
            preview();
        }}
        onPointerLeave={() => {
          suppressHover.current = false;
          leave();
        }}
        onFocus={preview}
        onBlur={() => {
          pinned.current = false;
          cancelLeave();
          setOpen(false);
        }}
        onClick={() => {
          cancelLeave();
          if (pinned.current) {
            pinned.current = false;
            setOpen(false);
          } else {
            pinned.current = true;
            preview();
          }
        }}
      >
        <IconInfo size={16} />
      </button>
      {open &&
        createPortal(
          <div
            ref={popup}
            id={tooltipId}
            role="tooltip"
            className={styles.popover}
            style={{ ...position, width: `min(${width}px, calc(100vw - 24px))` }}
            onPointerEnter={cancelLeave}
            onPointerLeave={leave}
          >
            <h3>{label}</h3>
            {children}
          </div>,
          document.body
        )}
    </>
  );
}
