export default function Reveal({ children, className = "", delay = 0, as: Tag = "div" }) {
  return (
    <Tag
      className={`reveal ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
      data-reveal
    >
      {children}
    </Tag>
  );
}