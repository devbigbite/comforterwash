"use client"
import { useEffect, useRef } from "react"

const SESSION_KEY = (role: string) => `washfold_worker_session_${role}`

export function WorkerNameInput({ name = "operatorName" }: { name?: string }) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY("operator"))
        ?? localStorage.getItem(SESSION_KEY("driver"))
        ?? localStorage.getItem(SESSION_KEY("admin"))
      if (raw && ref.current) {
        const session = JSON.parse(raw)
        if (session?.workerName) ref.current.value = session.workerName
      }
    } catch {}
  }, [])

  return (
    <input
      ref={ref}
      name={name}
      type="hidden"
    />
  )
}
