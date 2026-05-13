import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-leaf-50">
      <div className="rounded-xl bg-white p-8 text-center shadow-lg">
        <h2 className="mb-2 text-3xl font-bold text-leaf-700">404</h2>
        <p className="mb-4 text-sm text-soil-500">
          Esta página no existe.
        </p>
        <Link
          href="/"
          className="rounded-lg bg-leaf-500 px-4 py-2 text-sm text-white hover:bg-leaf-600"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
