import { useEffect, useRef } from "react";

// Invisible marker at the end of a list: calls onVisible when it scrolls into view (a bit
// early, so the next page is usually there before the user reaches the end). Works with any
// scrolling ancestor, for lists that scroll with their page rather than in their own box.
export const LoadMoreSentinel = ({ onVisible, disabled }: { onVisible: () => void; disabled: boolean }) => {
  const ref = useRef<HTMLDivElement>(null);
  const onVisibleRef = useRef(onVisible);
  useEffect(() => {
    onVisibleRef.current = onVisible;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el || disabled || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onVisibleRef.current();
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [disabled]);

  return <div ref={ref} aria-hidden className="h-px" />;
};
