import FormPublicoApp from "@/components/forms/FormPublicoApp";
import { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/forms/${slug}`);
    if (res.ok) {
      const form = await res.json();
      return { title: form.titulo ?? "Formulário", description: form.descricao ?? "" };
    }
  } catch { /* */ }
  return { title: "Formulário | Maestria Social" };
}

export default async function FormPublicoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <FormPublicoApp slug={slug} />;
}
