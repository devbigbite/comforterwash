import { getPitchTemplate } from "@/app/actions/outreach"
import { notFound } from "next/navigation"
import PitchEditorClient from "./pitch-editor-client"

export default async function PitchEditorPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const template = await getPitchTemplate(slug)
  if (!template) notFound()

  return <PitchEditorClient template={template} />
}
