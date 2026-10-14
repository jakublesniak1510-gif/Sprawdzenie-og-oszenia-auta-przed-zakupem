export function Disclaimer({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 ${className}`} role="note">
      <strong>Ważne:</strong> raport jest pomocą, nie ekspertyzą. Opiera się na treści ogłoszenia i danych, które wkleisz.
      Przed zakupem zawsze zrób oględziny auta u niezależnego mechanika.
    </div>
  );
}
