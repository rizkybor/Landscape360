import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { LegalSection, SitePageLayout } from "./SitePageLayout";
import { LEGAL_LAST_UPDATED } from "../config";

const STORAGE_ROWS: [string, string, string, string][] = [
  ["Necessary", "Sign-in session (sb-…-auth-token)", "Keeps you signed in", "Until you sign out"],
  ["Necessary", "map-storage, landscape360-survey-store, landscape360-offline-store", "Remembers your map view, style and settings", "Until you clear site data"],
  ["Necessary", "IndexedDB (offline map tiles, track recordings)", "Makes offline maps and recordings work without signal", "Until you delete them"],
  ["Analytics", "Vercel Web Analytics & Speed Insights", "Anonymous page views and performance; no cookies", "Not stored on your device"],
  ["Advertising", "Advertising partner (Monetag)", "Shows and measures ads; may set its own cookies", "Set by the partner"],
];

export const PrivacyPage = () => {
  return (
    <SitePageLayout
      title="Privacy Policy"
      subtitle={`Last updated ${LEGAL_LAST_UPDATED}`}
      icon={ShieldCheck}
      path="/privacy"
      seoDescription="How Landscape 360 collects, uses and protects your personal data."
    >
      <p className="text-sm text-sand-700 leading-relaxed mb-10">
        This policy explains what personal data Landscape 360 collects, why, who we share it with
        and the rights you have, in line with Indonesia's Personal Data Protection Law (Undang-Undang
        Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi).
      </p>

      <div className="space-y-10">
        <LegalSection title="1. Who we are">
          <p>
            Landscape 360 is operated by <strong>Jendela Cakra Digital</strong>, which decides how
            your personal data is used (the data controller). Contact us about privacy at{" "}
            <strong>contact@jcdigital.co.id</strong>.
          </p>
        </LegalSection>

        <LegalSection title="2. Data we collect">
          <ul>
            <li><strong>Account request:</strong> email, full name, organization, phone / WhatsApp number and your message.</li>
            <li><strong>Account:</strong> email, display name, plan and role. Passwords are stored only in encrypted (hashed) form by our sign-in provider; we never see them.</li>
            <li><strong>Location and activity data you create:</strong> surveys and points, marked locations, recorded tracks, uploaded custom maps, and, when you turn on GPS Tracking, your live position.</li>
            <li><strong>S.O.S:</strong> when you send an S.O.S, your position, battery level and messages go to the admin. Your emergency contacts stay on your phone.</li>
            <li><strong>Sharing:</strong> which accounts you share locations or tracks with.</li>
            <li><strong>Sign-in history:</strong> the time of each sign-in and the browser and device type, kept to protect accounts.</li>
            <li><strong>Reviews:</strong> your rating and comment, shown publicly with your first name, last initial and, if you set one in your profile, your organization.</li>
            <li><strong>Usage information:</strong> cloud storage used per feature, and anonymous page view and performance statistics.</li>
            <li><strong>Technical data:</strong> IP address and browser information processed by our hosting and map providers to deliver the Service.</li>
          </ul>
          <p>
            The mobile app uses your location in the background only while you record a track,
            share your position with GPS Tracking or send an S.O.S; a notification (Android) or the
            blue location indicator (iPhone) shows while it does. The website uses GPS only while a
            feature that needs it is on.
          </p>
        </LegalSection>

        <LegalSection title="3. How we use your data">
          <ul>
            <li>to create and run your account and the features you use (maps, tracking, sharing, offline data);</li>
            <li>to review account requests and to contact you about your account, plan or requests;</li>
            <li>to keep the Service secure, prevent abuse and apply plan limits;</li>
            <li>to understand and improve the Service with anonymous statistics;</li>
            <li>to show ads through our advertising partner (website only; the mobile app has no ads);</li>
            <li>to meet legal obligations.</li>
          </ul>
          <p>
            We process data to provide the Service you asked for, based on your consent (for example
            live GPS sharing), for our legitimate interests in keeping the Service safe, funding it
            with ads and improving it with anonymous statistics, and where the law requires it. We do <strong>not</strong> sell your
            personal data.
          </p>
        </LegalSection>

        <LegalSection title="4. Who we share data with">
          <ul>
            <li><strong>People you choose:</strong> accounts you share locations or tracks with, and monitor accounts of your team when you broadcast your position.</li>
            <li><strong>The public:</strong> your reviews (first name and last initial, organization if set, rating and comment).</li>
            <li><strong>Service providers</strong> that process data for us: Supabase (database and sign-in), Vercel (hosting and anonymous analytics), Mapbox (map tiles and terrain), BMKG (weather requests), Google Maps (only when you open Directions) and our advertising partner, which processes data under its own privacy policy.</li>
            <li><strong>Authorities,</strong> when the law requires it.</li>
          </ul>
          <p>
            Some providers store or process data outside Indonesia. We use providers that protect
            data with industry-standard security, and transfer data only as needed to run the
            Service.
          </p>
        </LegalSection>

        <LegalSection title="5. How long we keep data">
          <ul>
            <li>Account data and the content you create: while your account exists, and deleted when you delete your account (User Account &gt; Delete account in the app, or <Link to="/delete-account" className="underline font-bold text-ink">landscape360.jcdigital.co.id/delete-account</Link>).</li>
            <li>Live GPS tracking logs: deleted automatically after <strong>7 days</strong>. Tracks you record and save are kept until you delete them.</li>
            <li>Sign-in history: the latest 100 sign-ins per account.</li>
            <li>Account requests: kept to handle the request and for our records; ask us to delete yours at any time.</li>
            <li>Data on your device (offline maps, local recordings, settings): until you delete it or clear your browser data.</li>
          </ul>
        </LegalSection>

        <LegalSection title="6. Security">
          <p>
            Data is encrypted in transit (HTTPS). Access to stored data is restricted per account
            by database rules, so other users can only see what you share with them. Only authorised
            staff can manage accounts. No system is completely secure, so please use a strong,
            unique password and tell us if you notice anything unusual.
          </p>
        </LegalSection>

        <LegalSection title="7. Your rights">
          <p>Under the Personal Data Protection Law you can:</p>
          <ul>
            <li>get information about and access the personal data we hold about you;</li>
            <li>correct inaccurate data (you can change your display name yourself in the User Account menu);</li>
            <li><Link to="/delete-account" className="underline font-bold text-ink">have your data deleted</Link>, or end the processing of it;</li>
            <li>withdraw consent at any time (for GPS sharing, turn it off; for cookies, use your browser settings);</li>
            <li>get a copy of your data (tracks and locations can be exported as GPX in the app);</li>
            <li>object to processing and complain to the competent authority.</li>
          </ul>
          <p>
            To use these rights, email <strong>contact@jcdigital.co.id</strong> from your account's
            email address. We will reply within the time required by law.
          </p>
        </LegalSection>

        <LegalSection title="8. Cookies and local storage">
          <p>
            We use the browser storage below. Necessary storage is needed for the Service to work.
            Our analytics do not use cookies. Our advertising partner may set its own cookies; you
            can block or delete cookies at any time in your browser settings, and an ad blocker
            stops the ads without affecting the rest of the Service.
          </p>
          <div className="overflow-x-auto rounded-xl border border-sand-200">
            <table className="w-full text-xs min-w-[560px]">
              <thead className="bg-sand-50 text-left text-[10px] uppercase tracking-wider text-sand-500">
                <tr>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Purpose</th>
                  <th className="px-3 py-2">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-100">
                {STORAGE_ROWS.map(([type, name, purpose, duration]) => (
                  <tr key={name}>
                    <td className="px-3 py-2 font-bold text-ink">{type}</td>
                    <td className="px-3 py-2 font-mono text-[11px]">{name}</td>
                    <td className="px-3 py-2">{purpose}</td>
                    <td className="px-3 py-2">{duration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </LegalSection>

        <LegalSection title="9. Children">
          <p>
            Landscape 360 is not intended for children under 17 without the permission of a parent
            or guardian. If you believe a child has given us personal data without permission,
            contact us and we will delete it.
          </p>
        </LegalSection>

        <LegalSection title="10. Changes to this policy">
          <p>
            We may update this policy. The date at the top shows the latest version, and we will
            give notice in the Service for important changes.
          </p>
        </LegalSection>
      </div>
    </SitePageLayout>
  );
};
