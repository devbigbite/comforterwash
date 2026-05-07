import { notFound } from "next/navigation"
import { PinGate } from "@/components/pin-gate"
import RunExecuteClient from "@/components/run-execute-client"
import { getTransportRunWithOrders } from "@/app/actions/transport-runs"

interface Props {
  params: Promise<{ id: string }>
}

export default async function OperatorRunPage({ params }: Props) {
  const { id } = await params
  const result = await getTransportRunWithOrders(id)

  if (!result) notFound()

  const { run, orders } = result

  // Only operator-role runs should be accessible here
  if (run.assigned_role !== "operator") notFound()

  return (
    <PinGate role="operator">
      <RunExecuteClient run={run} orders={orders} role="operator" />
    </PinGate>
  )
}
