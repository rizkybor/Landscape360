import { useEffect, useRef } from 'react';

// The browser / phone Back button closes the topmost open layer (a full-screen panel, then a page
// inside it), as in the mobile app. Each active layer adds one history entry at the same URL that
// keeps the router's state and records how many layers were open, so the router sees no navigation.
// After any history move, layers deeper than the entry we land on are closed; a layer closed from
// the UI takes its entry back off, landing on an entry that matches what is still open.

interface Layer {
  back: () => void;
  popped: boolean;
}

const stack: Layer[] = [];
let pendingBack = 0;
let listening = false;

const depthOf = (state: unknown) => {
  const d = (state as { l360Layer?: unknown } | null)?.l360Layer;
  return typeof d === 'number' ? d : 0;
};

const onPop = (e: PopStateEvent) => {
  const depth = depthOf(e.state);
  while (stack.length > depth) {
    const top = stack.pop()!;
    top.popped = true;
    top.back();
  }
};

// Several layers closing at once (the panel with a chat open) go back in one step
const scheduleBack = () => {
  pendingBack++;
  if (pendingBack > 1) return;
  queueMicrotask(() => {
    const n = pendingBack;
    pendingBack = 0;
    window.history.go(-n);
  });
};

export const useBackLayer = (active: boolean, onBack: () => void) => {
  const latest = useRef(onBack);
  useEffect(() => {
    latest.current = onBack;
  });

  useEffect(() => {
    if (!active) return;
    const layer: Layer = { back: () => latest.current(), popped: false };
    // One listener for every layer; with none open, Back presses go through as usual
    if (!listening) {
      window.addEventListener('popstate', onPop);
      listening = true;
    }
    stack.push(layer);
    window.history.pushState({ ...(window.history.state ?? {}), l360Layer: stack.length }, '');
    return () => {
      const i = stack.indexOf(layer);
      if (i >= 0) stack.splice(i, 1);
      if (!layer.popped) scheduleBack();
    };
  }, [active]);
};
