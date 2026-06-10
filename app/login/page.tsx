import { Suspense } from "react"
import { LoginForm } from "./login-client"

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
