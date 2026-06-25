import { listPitchTemplates, listProspects } from "@/app/actions/outreach"
import OutreachClient from "./outreach-client"

export const metadata = { title: "Commercial Outreach — WashFold" }

export default async function OutreachPage() {
  const [templates, prospects] = await Promise.all([
    listPitchTemplates(),
    listProspects(),
  ])

  return <OutreachClient templates={templates} prospects={prospects} />
}
