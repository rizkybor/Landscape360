import { useEffect } from "react";
import { parsePostParam } from "../lib/community";
import { useCommunityStore } from "../store/useCommunityStore";

// A Community post opened on the map (/?post=<id>, from "Show on the map" on its public page):
// opens the Community panel at that post; the panel and CommunityLayer show it
export const SharedPostLink = () => {
  useEffect(() => {
    const id = parsePostParam(window.location.search);
    if (!id) return;
    useCommunityStore.getState().openPost(id);
    const url = new URL(window.location.href);
    url.searchParams.delete("post");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, []);
  return null;
};
