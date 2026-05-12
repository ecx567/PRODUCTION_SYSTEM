"use client";

import { Sprout, Wifi, Thermometer, Droplets } from "lucide-react";

export default function IoTPage() {
  return (
    <div className="min-h-screen bg-leaf-50">
      {/* Header */}
      <header className="border-b border-leaf-100 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-leaf-500">
              <Wifi className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-leaf-800">
                Sistema IoT
              </h1>
              <p className="text-xs text-soil-500">
                Monitoreo de Sensores en Tiempo Real
              </p>
            </div>
          </div>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
            Public access
          </span>
        </div>
      </header>

      {/* Hero placeholder */}
      <main className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-12 rounded-2xl border border-dashed border-leaf-200 bg-white/60 p-12 text-center backdrop-blur-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-leaf-100">
            <Sprout className="h-8 w-8 text-leaf-500" />
          </div>
          <h2 className="mb-2 text-xl font-semibold text-leaf-800">
            Conectate para ver datos en vivo
          </h2>
          <p className="mx-auto mb-6 max-w-md text-sm text-soil-500">
            Iniciá sesión para acceder a lecturas de sensores, históricos,
            alertas inteligentes y predicciones de tus cultivos.
          </p>
          <a
            href="/auth/login"
            className="inline-flex items-center gap-2 rounded-lg bg-leaf-500 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-leaf-600"
          >
            Ir a Login
          </a>
        </div>

        {/* Feature cards preview */}
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-xl border border-leaf-100 bg-white p-6">
            <Thermometer className="mb-3 h-8 w-8 text-leaf-400" />
            <h3 className="mb-1 font-semibold text-leaf-800">
              Temperatura & Humedad
            </h3>
            <p className="text-xs text-soil-400">
              Sensores DHT22 con lecturas cada 5 minutos
            </p>
          </div>
          <div className="rounded-xl border border-leaf-100 bg-white p-6">
            <Droplets className="mb-3 h-8 w-8 text-leaf-400" />
            <h3 className="mb-1 font-semibold text-leaf-800">
              Humedad de Suelo
            </h3>
            <p className="text-xs text-soil-400">
              Monitoreo de humedad en tiempo real por cultivo
            </p>
          </div>
          <div className="rounded-xl border border-leaf-100 bg-white p-6">
            <Wifi className="mb-3 h-8 w-8 text-leaf-400" />
            <h3 className="mb-1 font-semibold text-leaf-800">
              Estado de Conexión
            </h3>
            <p className="text-xs text-soil-400">
              Indicador de conexión de cada sensor IoT
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
