import { Link } from "react-router-dom";
import { FileText } from "lucide-react";
import { LegalSection, SitePageLayout } from "./SitePageLayout";
import { LEGAL_LAST_UPDATED } from "../config";

const SECTIONS = [
  ["about", "1. About these Terms"],
  ["accounts", "2. Accounts"],
  ["plans", "3. Plans and upgrades"],
  ["use", "4. Acceptable use"],
  ["content", "5. Your content and reviews"],
  ["safety", "6. Outdoor safety"],
  ["third-party", "7. Third-party services"],
  ["availability", "8. Availability and changes"],
  ["liability", "9. Limitation of liability"],
  ["termination", "10. Suspension and termination"],
  ["changes", "11. Changes to these Terms"],
  ["law", "12. Governing law"],
  ["contact", "13. Contact"],
] as const;

export const TermsPage = () => (
  <SitePageLayout
    title="Terms & Conditions"
    subtitle={`Last updated ${LEGAL_LAST_UPDATED}`}
    icon={FileText}
    path="/terms"
    seoDescription="The terms and conditions for using Landscape 360."
  >
    <p className="text-sm text-sand-700 leading-relaxed mb-6">
      Please read these Terms carefully. By using Landscape 360 you agree to them. If you do not
      agree, please do not use the service.
    </p>

    <nav className="mb-10 p-4 rounded-2xl bg-sand-50 border border-sand-200" aria-label="Contents">
      <div className="text-xs font-bold text-sand-500 uppercase tracking-wider mb-2">Contents</div>
      <ol className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
        {SECTIONS.map(([id, title]) => (
          <li key={id}>
            <a href={`#${id}`} className="text-sm text-forest-700 hover:underline">{title}</a>
          </li>
        ))}
      </ol>
    </nav>

    <div className="space-y-10">
      <LegalSection id="about" title="1. About these Terms">
        <p>
          These Terms govern your use of Landscape 360 at landscape360.jcdigital.co.id (the
          "Service"), operated by <strong>Jendela Cakra Digital</strong> ("we", "us"), developed in
          collaboration with Makopala Universitas Budi Luhur.
        </p>
        <p>
          Our <Link to="/privacy" className="text-forest-700 font-semibold hover:underline">Privacy Policy</Link>{" "}
          explains how we handle your personal data and forms part of these Terms.
        </p>
      </LegalSection>

      <LegalSection id="accounts" title="2. Accounts">
        <ul>
          <li>Accounts are created after we approve a request made through <strong>Request Account</strong>. We may decline a request without giving a reason.</li>
          <li>Give accurate information and keep it up to date. One account is for one person; do not share your login.</li>
          <li>Keep your password secret. You are responsible for activity on your account; tell us straight away at contact@jcdigital.co.id if you think it has been misused.</li>
          <li>If you are under 17, you need the permission of a parent or guardian to use an account.</li>
        </ul>
      </LegalSection>

      <LegalSection id="plans" title="3. Plans and upgrades">
        <ul>
          <li>Every new account starts on the <strong>Free</strong> plan. The features and limits of the Free, Pro and Enterprise plans are described in the <Link to="/docs" className="text-forest-700 font-semibold hover:underline">Documentation</Link>.</li>
          <li>To upgrade, send a request by email to <strong>contact@jcdigital.co.id</strong>. Any fees and payment terms for paid plans are agreed with you by email before the upgrade.</li>
          <li>We may adjust features and limits over time. If a limit is lowered, existing data is not deleted, but you may not be able to add new data until you are within the limit.</li>
        </ul>
      </LegalSection>

      <LegalSection id="use" title="4. Acceptable use">
        <p>You agree not to:</p>
        <ul>
          <li>break any law, or use the Service to harass, threaten, track or monitor anyone without their consent;</li>
          <li>upload or share content that is unlawful, offensive, infringing or misleading, including fake reviews;</li>
          <li>try to access other accounts or data, probe or attack the Service, bypass its limits or security, or overload it;</li>
          <li>copy, scrape, resell or reverse engineer the Service or its data, except where the law allows;</li>
          <li>use the Service in a way that damages Landscape 360, its users or its partners.</li>
        </ul>
      </LegalSection>

      <LegalSection id="content" title="5. Your content and reviews">
        <ul>
          <li>Surveys, tracks, marked locations, uploaded maps and reviews you create remain yours. You allow us to store, process and display them only as needed to run the Service (for example, showing a location to the people you share it with).</li>
          <li>When you share content with another account, that person can see it until you stop sharing it.</li>
          <li>Reviews are public and shown with your first name and last initial, and your organization if you set one in your profile. Only account holders can write a review, one per account; you can edit or delete it at any time. Replies come from the Landscape 360 team.</li>
          <li>We may hide or remove content, including reviews, that breaks these Terms.</li>
        </ul>
      </LegalSection>

      <LegalSection id="safety" title="6. Outdoor safety">
        <p>
          Outdoor activities such as hiking and climbing carry real risks. Landscape 360 is a
          planning and navigation aid, <strong>not a replacement</strong> for a paper map, compass,
          training, local guides or official information.
        </p>
        <ul>
          <li>Maps, elevation, contours, routes, GPS positions, weather and points of interest may be incomplete, outdated or inaccurate.</li>
          <li>Phones lose signal and battery. Always plan for the Service to stop working and carry backup navigation.</li>
          <li>Check official sources (such as national park offices and BMKG) before and during your trip, and follow the rules of the area.</li>
          <li>In an emergency in Indonesia, call <strong>112</strong> or the search and rescue agency Basarnas at <strong>115</strong>.</li>
        </ul>
        <p>You use the Service and make decisions in the field at your own risk.</p>
      </LegalSection>

      <LegalSection id="third-party" title="7. Third-party services">
        <p>
          The Service relies on third parties, including Mapbox (maps and terrain), BMKG (weather),
          Google Maps (directions you open), Supabase (database and sign-in) and Vercel (hosting).
          Their availability and accuracy are outside our control, and their own terms apply when
          you use them.
        </p>
      </LegalSection>

      <LegalSection id="availability" title="8. Availability and changes">
        <p>
          We work to keep the Service available and your data safe, but we provide it "as is" and
          "as available", without guarantees that it will always be uninterrupted, error free or
          suitable for a particular purpose. We may change, add or remove features, and may carry
          out maintenance that briefly interrupts the Service.
        </p>
      </LegalSection>

      <LegalSection id="liability" title="9. Limitation of liability">
        <p>
          To the extent permitted by law, we are not liable for indirect or consequential loss, or
          for injury, loss or damage resulting from relying on information in the Service, from
          outdoor activities, or from events outside our reasonable control. Nothing in these Terms
          limits liability that cannot be limited under Indonesian law.
        </p>
      </LegalSection>

      <LegalSection id="termination" title="10. Suspension and termination">
        <ul>
          <li>You can stop using the Service at any time and delete your account yourself (User Account &gt; Delete account in the app, or the Delete account page at landscape360.jcdigital.co.id/delete-account), or ask us to by emailing contact@jcdigital.co.id.</li>
          <li>We may suspend or close an account that breaks these Terms or puts the Service or other users at risk. Where reasonable, we will tell you first.</li>
        </ul>
      </LegalSection>

      <LegalSection id="changes" title="11. Changes to these Terms">
        <p>
          We may update these Terms. The date at the top shows the latest version. For important
          changes we will give notice in the Service. Continuing to use the Service after a change
          means you accept the updated Terms.
        </p>
      </LegalSection>

      <LegalSection id="law" title="12. Governing law">
        <p>
          These Terms are governed by the laws of the Republic of Indonesia. We will first try to
          resolve any dispute with you amicably; if that fails, the dispute will be settled by the
          competent courts in Indonesia.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="13. Contact">
        <p>
          Questions about these Terms: <strong>contact@jcdigital.co.id</strong>.
        </p>
      </LegalSection>
    </div>
  </SitePageLayout>
);
