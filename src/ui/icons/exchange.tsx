const ExchangeIcon = ({ color = "#121212", ...props }: { color?: string; style?: React.CSSProperties } & React.SVGProps<SVGSVGElement>) => {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M14 5.5L19 10.5H5" stroke={color} stroke-width="1.5" stroke-linecap="round" />
      <path d="M11 19L6 14H20" stroke={color} stroke-width="1.5" stroke-linecap="round" />
    </svg>
  );
};

export default ExchangeIcon;
