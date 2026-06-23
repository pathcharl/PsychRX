import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/public/legal-page";

export const metadata: Metadata = {
  title: "Terms & Conditions — PsychRx",
  description:
    "PsychRx terms of service, appointment policies, SMS consent, and payment terms.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms & Conditions" lastUpdated="March 22, 2026">
      <LegalSection title="Agreement to Terms">
        <p>
          By accessing or using PsychRx services — including our website,
          scheduling tools, patient portal, and provider portal — you agree to
          these Terms & Conditions. PsychRx LLC operates as a service of Balance
          Point Medical Corp, headquartered in Fort Myers, Florida.
        </p>
        <p>
          If you do not agree to these terms, please do not use our services.
        </p>
      </LegalSection>

      <LegalSection title="Services">
        <p>
          PsychRx connects patients with licensed mental health professionals
          for therapy, medication management, psychological testing, and related
          telehealth services. PsychRx provides scheduling, care coordination,
          and practice support tools. Clinical care is delivered by independent
          licensed providers who maintain their own professional obligations.
        </p>
      </LegalSection>

      <LegalSection title="SMS Messaging Consent">
        <p>
          By providing your phone number and using PsychRx services, you consent
          to receive SMS text messages for appointment confirmations, reminders,
          care coordination, and account-related notifications. Message frequency
          varies. Message and data rates may apply.
        </p>
        <p>
          <strong className="text-navy">Opt out:</strong> Reply{" "}
          <strong className="text-teal">STOP</strong> to any PsychRx text to
          unsubscribe. Reply <strong className="text-teal">HELP</strong> for
          help. Opting out of SMS does not affect your right to receive care,
          but may limit automated reminders.
        </p>
      </LegalSection>

      <LegalSection title="Appointments & Cancellation Policy">
        <p>
          Appointments may be scheduled through our online booking system or care
          team. You agree to attend scheduled sessions or cancel with adequate
          notice.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-navy">Free cancellation</strong> — Cancel
            at least 24 hours before your scheduled appointment at no charge.
          </li>
          <li>
            <strong className="text-navy">Late cancellation / no-show</strong> —
            Cancellations made less than 24 hours before the appointment, or
            missed appointments without notice, may incur a{" "}
            <strong className="text-navy">$75 fee</strong>.
          </li>
          <li>
            A valid payment method on file may be required to hold your
            appointment.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Payment Terms">
        <p>
          Fees for services depend on your insurance coverage, copay, deductible,
          or self-pay arrangement. You authorize PsychRx and your provider to
          charge your payment method on file for applicable copays, balances, and
          fees described in these terms.
        </p>
        <p>
          Insurance verification is provided for convenience; final coverage
          determinations are made by your payer. You remain responsible for
          amounts not covered by insurance.
        </p>
      </LegalSection>

      <LegalSection title="HIPAA Acknowledgment">
        <p>
          You acknowledge that PsychRx and its affiliated providers maintain
          policies and procedures designed to comply with HIPAA. Protected Health
          Information will be used and disclosed only as permitted by law, our
          Notice of Privacy Practices, and your authorization where required.
        </p>
        <p>
          Telehealth services involve electronic communication of health
          information. You accept the benefits and limitations of receiving
          care through secure video, phone, or messaging platforms.
        </p>
      </LegalSection>

      <LegalSection title="Account Responsibilities">
        <p>
          You are responsible for maintaining the confidentiality of your portal
          login credentials and for all activity under your account. Notify us
          immediately if you suspect unauthorized access.
        </p>
      </LegalSection>

      <LegalSection title="Limitation of Liability">
        <p>
          PsychRx provides technology and coordination services. To the fullest
          extent permitted by law, PsychRx is not liable for indirect or
          consequential damages arising from use of the platform. Clinical
          decisions remain the responsibility of your treating provider.
        </p>
      </LegalSection>

      <LegalSection title="Changes to Terms">
        <p>
          We may update these Terms from time to time. Continued use of PsychRx
          services after changes are posted constitutes acceptance of the
          revised terms.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions about these Terms & Conditions:
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
