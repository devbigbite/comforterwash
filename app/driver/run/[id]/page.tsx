import { notFound } from "next/navigation"
import { PinGate } from "@/components/pin-gate"
import RunExecuteClient from "@/components/run-execute-client"
import { getTransportRunWithOrders } from "@/app/actions/transport-runs"

interface Props {
  params: Promise<{ id: string }>
}

export default async function DriverRunPage({ params }: Props) {
  const { id } = await params
  const result = await getTransportRunWithOrders(id)

  if (!result) notFound()

  const { run, orders } = result

  // Only driver-role runs should be accessible here
  if (run.assigned_role !== "driver") notFound()

  return (
    <PinGate role="driver">
      <RunExecuteClient run={run} orders={orders} role="driver" />
    </PinGate>
  )
}
