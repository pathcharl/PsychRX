export function CrisisFooter() {
  return (
    <footer
      className="sticky bottom-0 z-40 w-full bg-teal px-4 py-3 text-center text-sm font-medium text-white"
      role="contentinfo"
    >
      If you are in crisis: Call or text{" "}
      <a href="tel:988" className="underline underline-offset-2">
        988
      </a>{" "}
      | Emergency: Call{" "}
      <a href="tel:911" className="underline underline-offset-2">
        911
      </a>
    </footer>
  );
}
