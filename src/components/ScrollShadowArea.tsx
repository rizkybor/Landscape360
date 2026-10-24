import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

// Scroll container with a soft shadow at each edge that still has content to scroll to,
// so the edge of the scroll area is visible. `horizontal` watches left/right instead of
// top/bottom (e.g. the tools carousel on phones).
const REACH_END_PX = 48;

export const ScrollShadowArea = ({
  className,
  wrapperClassName = "",
  horizontal = false,
  onReachEnd,
  children,
}: {
  className: string;
  wrapperClassName?: string;
  horizontal?: boolean;
  // Called when the scroll position comes near the end (e.g. to load the next page);
  // also when the content is too short to scroll at all
  onReachEnd?: () => void;
  children: ReactNode;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const onReachEndRef = useRef(onReachEnd);
  useEffect(() => {
    onReachEndRef.current = onReachEnd;
  });
  const [edges, setEdges] = useState({ start: false, end: false });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const [pos, size, total] = horizontal
      ? [el.scrollLeft, el.clientWidth, el.scrollWidth]
      : [el.scrollTop, el.clientHeight, el.scrollHeight];
    const start = pos > 2;
    const end = pos + size < total - 2;
    if (pos + size >= total - REACH_END_PX) onReachEndRef.current?.();
    setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  }, [horizontal]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Measure on the next frame, once the new content is laid out
    const frame = requestAnimationFrame(update);
    // Re-check when the area or its content changes size (opening, collapsing, new items)
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    if (observer) {
      observer.observe(el);
      Array.from(el.children).forEach((child) => observer.observe(child));
    }
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [update, children]);

  const shadow = `pointer-events-none absolute z-10 transition-opacity duration-200 ${horizontal ? "inset-y-0 w-4" : "inset-x-0 h-3"}`;
  const [startEdge, endEdge] = horizontal
    ? ["left-0 bg-gradient-to-r", "right-0 bg-gradient-to-l"]
    : ["top-0 bg-gradient-to-b", "bottom-0 bg-gradient-to-t"];
  // The wrapper can shrink inside the panel's flex column (min-h-0), like the scroll area
  // itself did before it was wrapped; otherwise its content spills out of the panel
  return (
    <div className={`relative flex flex-col min-h-0 ${wrapperClassName}`}>
      <div ref={ref} className={`min-h-0 ${className}`} onScroll={update}>
        {children}
      </div>
      <div aria-hidden className={`${shadow} ${startEdge} from-ink/15 to-transparent ${edges.start ? "opacity-100" : "opacity-0"}`} />
      <div aria-hidden className={`${shadow} ${endEdge} from-ink/15 to-transparent ${edges.end ? "opacity-100" : "opacity-0"}`} />
    </div>
  );
};
