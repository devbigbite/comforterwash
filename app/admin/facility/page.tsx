import { getFacilityBoardOrders, getActiveFacilities } from "@/app/actions/facility-board"
import { PHASES } from "@/lib/facility-phases"
import { FacilityBoard } from "./facility-board"

export default async function FacilityPage({
  searchParams,
}: {
  searchParams: Promise<{ facility?: string }>
}) {
  const { facility: facilityId } = await searchParams
  const [grouped, facilities] = await Promise.all([
    getFacilityBoardOrders(facilityId),
    getActiveFacilities(),
  ])

  return (
    <FacilityBoard
      initialGrouped={grouped}
      facilities={facilities}
      selectedFacilityId={facilityId ?? null}
      phases={PHASES}
    />
  )
}
