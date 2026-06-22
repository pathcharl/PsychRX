import {
  PastAppointmentRow,
  RequestSoonerForm,
  UpcomingAppointmentRow,
} from "@/components/patient-portal/portal-sections";
import { requirePortalPatient } from "@/lib/patient-portal/auth";
import { fetchAppointmentsData } from "@/lib/patient-portal/data";

export default async function PatientPortalAppointmentsPage() {
  const ctx = await requirePortalPatient();
  if (!ctx) return null;

  const data = await fetchAppointmentsData(ctx.patient);

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 py-8 sm:px-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-navy">
          My Appointments
        </h1>
        <p className="mt-1 text-navy/70">
          View, reschedule, or cancel upcoming sessions
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="font-heading text-xl font-semibold text-navy">
          Upcoming
        </h2>
        {data.upcoming.length === 0 ? (
          <p className="rounded-xl border border-navy/10 bg-white p-6 text-sm text-navy/60">
            No upcoming appointments.
          </p>
        ) : (
          data.upcoming.map((appt) => (
            <UpcomingAppointmentRow
              key={appt.id}
              appointment={appt}
              patient={ctx.patient}
            />
          ))
        )}
      </section>

      <RequestSoonerForm patientId={ctx.patient.id} />

      <section className="space-y-4">
        <h2 className="font-heading text-xl font-semibold text-navy">
          Past Appointments
        </h2>
        {data.past.length === 0 ? (
          <p className="rounded-xl border border-navy/10 bg-white p-6 text-sm text-navy/60">
            No past appointments on file.
          </p>
        ) : (
          data.past.map((appt) => (
            <PastAppointmentRow key={appt.id} appointment={appt} />
          ))
        )}
      </section>
    </div>
  );
}
