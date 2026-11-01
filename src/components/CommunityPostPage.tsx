import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2, MapPin, MessageCircle, MessagesSquare, Paperclip, ThumbsUp } from "lucide-react";
import { SitePageLayout } from "./SitePageLayout";
import { conditionOf, fetchComments, fetchPost, isOldReport, photoUrl, type CommunityComment, type CommunityPost } from "../lib/community";

const day = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

// Public page of a Community post (/community/<id>): readable without signing in, for links
// shared on WhatsApp and for search engines. Club posts are only shown to members.
export const CommunityPostPage = () => {
  const { id = "" } = useParams();
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "gone" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchPost(id), fetchComments(id)])
      .then(([p, c]) => {
        if (cancelled) return;
        setPost(p);
        setComments(c);
        setStatus(p ? "ok" : "gone");
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const kind = post?.kind === "story" ? "Story" : "Trail report";
  const title = post ? (post.title ?? `${kind}${post.placeName ? `: ${post.placeName}` : ""}`) : "Community";
  const description = post ? post.body.replace(/\s+/g, " ").slice(0, 155) : "Trail reports and trip stories from Landscape 360 hikers.";

  return (
    <SitePageLayout
      title={title}
      subtitle={post ? `${kind} · Landscape 360 Community` : "Landscape 360 Community"}
      icon={MessagesSquare}
      path={`/community/${id}`}
      seoDescription={description}
      structuredData={
        post
          ? [{
              "@context": "https://schema.org",
              "@type": "SocialMediaPosting",
              headline: title,
              articleBody: post.body,
              datePublished: new Date(post.createdAt).toISOString(),
              author: { "@type": "Person", name: post.authorName },
              contentLocation: { "@type": "Place", name: post.placeName ?? undefined, geo: { "@type": "GeoCoordinates", latitude: post.lat, longitude: post.lng } },
              image: post.photos.map((p) => photoUrl(p.path)),
            }]
          : undefined
      }
    >
      {status === "loading" && (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-sand-500" />
        </div>
      )}
      {(status === "gone" || status === "error") && (
        <div className="py-16 text-center space-y-3">
          <p className="text-sm text-sand-700">
            {status === "gone"
              ? "This post is not available. It may have been deleted, or it is for club members only."
              : "Could not load this post. Check your connection and try again."}
          </p>
          <Link to="/" className="inline-block px-4 py-2 rounded-lg bg-forest-800 text-white text-sm font-bold">
            Open the map
          </Link>
        </div>
      )}
      {post && (
        <article className="space-y-5 max-w-2xl">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-bold uppercase tracking-wider text-gold-700">{kind}</span>
              {isOldReport(post) && <span className="font-bold uppercase text-sand-500">· over 30 days old</span>}
            </div>
            {post.conditions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {post.conditions.map((c) => (
                  <span key={c} className="px-2 py-0.5 rounded-full text-[11px] font-bold text-white" style={{ backgroundColor: conditionOf(c).color }}>
                    {conditionOf(c).label}
                  </span>
                ))}
              </div>
            )}
            <p className="text-sm text-sand-600">
              <MapPin size={13} className="inline -mt-0.5" /> {post.placeName ?? `${post.lat.toFixed(5)}, ${post.lng.toFixed(5)}`} · {day(post.happenedOn)}
            </p>
            <p className="text-xs text-sand-500">
              By {post.authorName}
              {post.authorOrganization ? ` · ${post.authorOrganization}` : ""}
              {post.editedAt ? " · edited" : ""}
            </p>
          </div>
          <p className="text-base text-ink whitespace-pre-wrap break-words leading-relaxed">{post.body}</p>
          {post.photos.length > 0 && (
            <div className={`grid gap-2 ${post.photos.length > 1 ? "grid-cols-2" : ""}`}>
              {post.photos.map((ph) => (
                <img key={ph.path} src={photoUrl(ph.path)} alt="" loading="lazy" width={ph.width} height={ph.height} className="w-full h-auto rounded-lg bg-sand-100" />
              ))}
            </div>
          )}
          {post.attachment && (
            <p className="text-sm text-sand-700 flex items-center gap-1.5">
              <Paperclip size={14} className="text-gold-700" /> Attached{" "}
              {post.attachment.kind === "classic" ? "Classic Field Work" : post.attachment.kind}: <strong>{post.attachment.name}</strong>
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Link to={`/?post=${post.id}`} className="px-4 py-2 rounded-lg bg-forest-800 hover:bg-forest-700 text-white font-bold">
              Show on the map
            </Link>
            <span className="flex items-center gap-1 text-sand-600">
              <ThumbsUp size={14} /> {post.helpfulCount} found it helpful
            </span>
            <span className="flex items-center gap-1 text-sand-600">
              <MessageCircle size={14} /> {post.commentCount}
            </span>
          </div>
          <p className="text-xs text-sand-500">
            Posts are from other hikers. Always check with the park or trail managers before you go.
          </p>
          {comments.length > 0 && (
            <section className="space-y-2 pt-4 border-t border-sand-200">
              <h2 className="text-sm font-bold">Comments</h2>
              {comments.map((c) => (
                <div key={c.id} className="rounded-lg bg-sand-50 border border-sand-100 px-3 py-2">
                  <div className="text-xs font-bold">
                    {c.authorName}
                    {c.authorOrganization && <span className="font-normal text-sand-500"> · {c.authorOrganization}</span>}
                  </div>
                  <p className="text-sm text-sand-700 whitespace-pre-wrap break-words">{c.body}</p>
                </div>
              ))}
              <p className="text-xs text-sand-500">Open it on the map to comment or mark it helpful.</p>
            </section>
          )}
        </article>
      )}
    </SitePageLayout>
  );
};
