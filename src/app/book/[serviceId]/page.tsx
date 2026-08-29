import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { getService, washServices } from "@/data/services";
import { BookingFlow } from "./BookingFlow";

export function generateStaticParams() {
  return washServices.map((service) => ({ serviceId: service.id }));
}

export default async function BookServicePage({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}) {
  const { serviceId } = await params;
  const service = getService(serviceId);
  if (!service) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader
        eyebrow="Wash bay"
        title={service.name}
        backHref="/book"
        backLabel="All services"
        intro={<p>{service.description}</p>}
      />
      <BookingFlow service={service} />
    </div>
  );
}
