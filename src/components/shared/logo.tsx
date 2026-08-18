export function AdswishLogo({
  className = "h-8 w-8",
  wordmark = true,
}: {
  className?: string;
  wordmark?: boolean;
}) {
  return (
    <svg
      viewBox={wordmark ? "0 0 140 40" : "0 0 40 40"}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Hexagon mark */}
      <path
        d="M17.5 2.5L31 10.25V25.75L17.5 33.5L4 25.75V10.25L17.5 2.5Z"
        fill="currentColor"
        opacity="0.15"
      />
      <path
        d="M17.5 2.5L31 10.25V25.75L17.5 33.5L4 25.75V10.25L17.5 2.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* A mark inside */}
      <path
        d="M12 24L17.5 10L23 24M14 20H21"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {wordmark && (
        <>
          {/* Wordmark */}
          <path
            d="M41.6 26.9H44.1L44.9 24.4H49.7L50.5 26.9H53.1L48.6 13.8H46L41.6 26.9ZM45.6 22.4L47.3 17.2L49 22.4H45.6Z"
            fill="currentColor"
          />
          <path
            d="M54.8 26.9H57.2V13.8H54.8V26.9Z"
            fill="currentColor"
          />
          <path
            d="M60.2 26.9H62.6V22.1L66.3 26.9H69.4L64.8 21.5L69.2 17H66.1L62.6 21V17H60.2V26.9Z"
            fill="currentColor"
          />
          <path
            d="M71.3 26.9H73.7V19.8L76.8 26.9H78.4L81.5 19.8V26.9H83.9V17H80.6L77.6 23.8L74.6 17H71.3V26.9Z"
            fill="currentColor"
          />
          <path
            d="M85.8 26.9H88.2V13.8H85.8V26.9Z"
            fill="currentColor"
          />
          <path
            d="M91.2 27C92.6 27 93.8 26.4 94.3 25.3V26.9H96.7V20.4C96.7 18.2 95 17 92.7 17C90.3 17 88.8 18.3 88.5 20L90.8 20.4C91 19.6 91.6 19.1 92.6 19.1C93.6 19.1 94.2 19.6 94.2 20.4V20.5C93.8 20.5 92.5 20.5 91.9 20.6C89.7 20.7 88.1 21.6 88.1 23.7C88.1 25.6 89.5 27 91.2 27ZM91.9 25.1C91 25.1 90.5 24.5 90.5 23.7C90.5 22.9 91 22.5 91.9 22.4C92.3 22.3 93.6 22.3 94.2 22.3V23.3C94.2 24.4 93.2 25.1 91.9 25.1Z"
            fill="currentColor"
          />
          <path
            d="M99.5 26.9H102L104 23.5L106 26.9H108.7L105.6 21.9L108.5 17H106L104.1 20.3L102.3 17H99.6L102.5 21.9L99.5 26.9Z"
            fill="currentColor"
          />
        </>
      )}
    </svg>
  );
}
