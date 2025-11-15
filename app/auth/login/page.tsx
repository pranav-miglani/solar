"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { motion } from "framer-motion"
import { Sun, Zap, Sparkles } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [focusedField, setFocusedField] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    console.log("🔐 [CLIENT] Login form submitted")
    setLoading(true)
    setError("")

    try {
      const loginData = { email, password }
      console.log("🔐 [CLIENT] Sending login request:", { email, passwordLength: password.length })
      
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(loginData),
      })

      console.log("🔐 [CLIENT] Response status:", response.status, response.statusText)
      console.log("🔐 [CLIENT] Response headers:", Object.fromEntries(response.headers.entries()))

      const data = await response.json()
      console.log("🔐 [CLIENT] Response data:", { ...data, account: data.account ? "present" : "missing" })

      if (!response.ok) {
        console.error("❌ [CLIENT] Login failed:", data.error)
        setError(data.error || "Login failed")
        setLoading(false)
        return
      }

      console.log("✅ [CLIENT] Login successful, redirecting...")
      // Redirect to dashboard or the redirect URL
      const redirect = searchParams.get("redirect") || "/dashboard"
      console.log("🔐 [CLIENT] Redirecting to:", redirect)
      
      // Use window.location for a hard redirect to ensure cookie is set
      // This ensures the browser fully reloads and picks up the new session cookie
      window.location.href = redirect
    } catch (err) {
      console.error("❌ [CLIENT] Login error:", err)
      setError("An error occurred. Please try again.")
      setLoading(false)
    }
  }

  // Solar panel grid pattern component
  const SolarPanelGrid = () => (
    <div className="absolute inset-0 overflow-hidden opacity-30">
      <div className="absolute inset-0" style={{
        backgroundImage: `
          repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(59, 130, 246, 0.1) 2px, rgba(59, 130, 246, 0.1) 4px),
          repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(59, 130, 246, 0.1) 2px, rgba(59, 130, 246, 0.1) 4px)
        `,
        backgroundSize: '40px 40px'
      }} />
      {/* Solar panel rows */}
      {Array.from({ length: 8 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-full h-24 border-t border-b border-blue-400/20"
          style={{
            top: `${i * 12}%`,
            background: `linear-gradient(90deg, 
              rgba(59, 130, 246, 0.1) 0%, 
              rgba(59, 130, 246, 0.2) 50%, 
              rgba(59, 130, 246, 0.1) 100%)`
          }}
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{
            duration: 20 + i * 2,
            repeat: Infinity,
            ease: "linear"
          }}
        />
      ))}
    </div>
  )

  // Floating energy particles
  const EnergyParticles = () => (
    <>
      {Array.from({ length: 12 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 bg-yellow-400 rounded-full blur-sm"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, Math.random() * 20 - 10, 0],
            opacity: [0.3, 0.8, 0.3],
            scale: [1, 1.5, 1],
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            repeat: Infinity,
            delay: Math.random() * 2,
            ease: "easeInOut"
          }}
        />
      ))}
    </>
  )

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Animated solar panel background */}
      <SolarPanelGrid />
      
      {/* Floating energy particles */}
      <EnergyParticles />

      {/* Sun glow effect */}
      <motion.div
        className="absolute top-20 right-20 w-64 h-64 bg-yellow-400 rounded-full blur-3xl opacity-20"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.2, 0.3, 0.2],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />

      {/* Main content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md px-6"
      >
        <Card className="backdrop-blur-xl bg-white/95 dark:bg-slate-900/95 border-2 border-white/20 shadow-2xl">
          <CardHeader className="text-center space-y-4 pb-6">
            {/* Solar-themed logo */}
            <motion.div
              className="flex justify-center mb-4"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            >
              <div className="relative">
                {/* Sun icon */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="absolute -top-2 -left-2"
                >
                  <Sun className="w-12 h-12 text-yellow-400 fill-yellow-400/30" />
                </motion.div>
                {/* Solar panel grid icon */}
                <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg shadow-lg p-2">
                  <div className="grid grid-cols-2 gap-1 h-full">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <motion.div
                        key={i}
                        className="bg-blue-400 rounded-sm"
                        animate={{
                          opacity: [0.5, 1, 0.5],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          delay: i * 0.2,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Welcome Back
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                Please sign in to your account
              </p>
            </motion.div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20 flex items-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  {error}
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
                className="space-y-2"
              >
                <Label htmlFor="email" className="text-sm font-medium flex items-center gap-2">
                  <span>Email</span>
                  {focusedField === "email" && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="text-yellow-500"
                    >
                      <Sparkles className="w-3 h-3" />
                    </motion.span>
                  )}
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusedField("email")}
                  onBlur={() => setFocusedField(null)}
                  required
                  className="h-12 border-2 transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  placeholder="admin@woms.com"
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 }}
                className="space-y-2"
              >
                <Label htmlFor="password" className="text-sm font-medium flex items-center gap-2">
                  <span>Password</span>
                  {focusedField === "password" && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="text-yellow-500"
                    >
                      <Sparkles className="w-3 h-3" />
                    </motion.span>
                  )}
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  required
                  className="h-12 border-2 transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Enter your password"
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
              >
                <Button
                  type="submit"
                  className="w-full h-12 text-base font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 relative overflow-hidden group"
                  disabled={loading}
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {loading ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        >
                          <Zap className="w-4 h-4" />
                        </motion.div>
                        Logging in...
                      </>
                    ) : (
                      <>
                        Sign in
                        <Zap className="w-4 h-4" />
                      </>
                    )}
                  </span>
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-yellow-400/20 to-transparent"
                    initial={{ x: "-100%" }}
                    animate={loading ? { x: "100%" } : {}}
                    transition={{ duration: 1.5, repeat: loading ? Infinity : 0 }}
                  />
                </Button>
              </motion.div>
            </form>

            {/* Footer info */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2"
            >
              <Zap className="w-3 h-3" />
              <span>Work Order Management System</span>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
