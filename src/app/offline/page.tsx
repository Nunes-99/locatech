"use client"

import { WifiOff, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center space-y-6">
        <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mx-auto">
          <WifiOff className="h-10 w-10 text-gray-500" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">
            Sem conexão
          </h1>
          <p className="text-gray-600 max-w-sm">
            Você está offline. Verifique sua conexão com a internet e tente novamente.
          </p>
        </div>

        <Button
          onClick={() => window.location.reload()}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </Button>
      </div>
    </div>
  )
}
