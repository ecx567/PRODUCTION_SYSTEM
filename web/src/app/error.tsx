"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-danger-50">
      <div className="rounded-xl bg-white p-8 text-center shadow-lg">
        <h2 className="mb-2 text-xl font-bold text-danger-600">
          Algo salió mal
        </h2>
        <p className="mb-4 text-sm text-soil-500">
          {error.message || "Ocurrió un error inesperado."}
        </p>
        <button
          onClick={reset}
          className="rounded-lg bg-leaf-500 px-4 py-2 text-sm text-white hover:bg-leaf-600"
        >
          Intentar de nuevo
        </button>
      </div>
    </div>
  );
}
