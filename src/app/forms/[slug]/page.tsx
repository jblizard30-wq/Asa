import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { IntakeFormPublic } from '@/components/IntakeFormPublic';

export default async function PublicIntakeFormPage({ params }: { params: { slug: string } }) {
  const form = await prisma.intakeForm.findUnique({
    where: { slug: params.slug },
    include: { fields: { orderBy: { order: 'asc' }, include: { options: { orderBy: { order: 'asc' } } } } },
  });

  if (!form || !form.isActive) notFound();

  return (
    <IntakeFormPublic
      slug={form.slug}
      name={form.name}
      description={form.description}
      fields={form.fields.map((f) => ({
        id: f.id,
        label: f.label,
        type: f.type,
        required: f.required,
        options: f.options.map((o) => ({ id: o.id, label: o.label })),
      }))}
    />
  );
}
