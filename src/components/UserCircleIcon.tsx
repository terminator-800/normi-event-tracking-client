/** User-in-circle outline (profile / account menu), uses currentColor. */
export default function UserCircleIcon({ className = "h-8 w-8" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="9" r="3" />
      <path d="M6.5 18.5c1.33-2.5 3.43-4 5.5-4s4.17 1.5 5.5 4" />
    </svg>
  );
}
