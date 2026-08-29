export default function Icon({ name, size = 24, className = '' }) {
  return (
    <span
      className={`material-symbols-rounded ${className}`}
      style={{ fontSize: size, width: size, height: size }}
    >
      {name}
    </span>
  )
}
