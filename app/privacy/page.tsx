import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/public/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy — PsychRx",
  description:
    "PsychRx privacy policy, HIPAA practices, and SMS communication preferences.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="March 22, 2026">
      <LegalSection title="Overview">
        <p>
          PsychRx LLC, operating as a service of Balance Point Medical Corp
          (&quot;PsychRx,&quot; &quot;we,&quot; &quot;us&quot;), provides
          mental health care coordination and telehealth services in Southwest
          Florida. This Privacy Policy explains how we collect, use, and protect
          your information when you use our website, patient portal, provider
          portal, and related services.
        </p>
      </LegalSection>

      <LegalSection title="Information We Collect">
        <p>We may collect the following types of information:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-navy">Personal information</strong> — name,
            date of birth, email, phone number, address, and emergency contact
            details.
          </li>
          <li>
            <strong className="text-navy">Health information</strong> —
            insurance details, clinical history, appointment records, messages
            with your care team, and treatment-related data you provide through
            our platform.
          </li>
          <li>
            <strong className="text-navy">Account information</strong> —
            login credentials and portal activity related to your PsychRx
            account.
          </li>
          <li>
            <strong className="text-navy">Technical information</strong> —
            device type, browser, IP address, and usage data collected through
            standard website analytics to improve our services.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="How We Use Your Information">
        <p>We use your information to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Schedule and manage appointments with licensed providers</li>
          <li>Verify insurance coverage and process billing</li>
          <li>Facilitate secure messaging between patients and providers</li>
          <li>Send appointment reminders, care updates, and service notifications</li>
          <li>Comply with legal, regulatory, and clinical requirements</li>
        </ul>
      </LegalSection>

      <LegalSection title="HIPAA & Protected Health Information">
        <p>
          PsychRx is committed to protecting your Protected Health Information
          (PHI) in accordance with the Health Insurance Portability and
          Accountability Act (HIPAA) and applicable state privacy laws. We
          implement administrative, technical, and physical safeguards designed
          to protect PHI, including encrypted data transmission, access controls,
          and business associate agreements with vendors who handle health
          information on our behalf.
        </p>
        <p>
          You have the right to access, request amendments to, and obtain an
          accounting of disclosures of your PHI as permitted by law. To exercise
          these rights, contact us using the information below.
        </p>
      </LegalSection>

      <LegalSection title="SMS & Text Messaging">
        <p>
          By providing your mobile phone number and opting in to PsychRx
          communications, you consent to receive SMS messages related to
          appointment scheduling, reminders, care coordination, and account
          notifications. Message frequency varies. Message and data rates may
          apply.
        </p>
        <p>
          <strong className="text-navy">Opt out:</strong> Reply{" "}
          <strong className="text-teal">STOP</strong> to any PsychRx text
          message to unsubscribe from SMS communications. Reply{" "}
          <strong className="text-teal">HELP</strong> for assistance. Opting out
          of SMS may limit our ability to send time-sensitive appointment
          reminders.
        </p>
      </LegalSection>

      <LegalSection title="Information Sharing">
        <p>
          We do not sell your personal or health information. We may share
          information with your treating providers, insurance payers (for
          billing), and service providers who assist in operating our platform
          under appropriate confidentiality agreements. We may also disclose
          information when required by law.
        </p>
      </LegalSection>

      <LegalSection title="Data Security">
        <p>
          We use industry-standard security measures to protect your data.
          However, no method of transmission over the internet is 100% secure.
          We encourage you to use strong passwords and keep your account
          credentials confidential.
        </p>
      </LegalSection>

      <LegalSection title="Contact Us">
        <p>
          For privacy questions, HIPAA requests, or to update your communication
          preferences, contact:
        </p>
        <p>
          <strong className="text-navy">PsychRx LLC / Balance Point Medical Corp</strong>
          <br />
          Fort Myers, Florida
          <br />
          Email:{" "}
          <a
            href="mailto:patrick@psychrx.com"
            className="font-medium text-teal hover:text-teal-700"
          >
            patrick@psychrx.com
          </a>
          <br />
          Phone:{" "}
          <a
            href="tel:18337792479"
            className="font-medium text-teal hover:text-teal-700"
          >
            1-833-PSYCHRX
          </a>
        </p>
      </LegalSection>
    </LegalPage>
  );
}
