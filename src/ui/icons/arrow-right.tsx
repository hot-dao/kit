export const ArrowRightIcon = ({ color = "#fff", ...props }: { color?: string } & React.SVGProps<SVGSVGElement>) => {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M14 12.5878L10.7071 15.8807C10.0771 16.5107 9 16.0645 9 15.1736L9 10.002C9 9.1111 10.0771 8.66493 10.7071 9.2949L14 12.5878Z" fill={color} />
    </svg>
  );
};
