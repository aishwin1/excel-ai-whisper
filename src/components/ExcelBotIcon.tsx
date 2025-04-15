
export const ExcelBotIcon = ({ size = 24, className = "" }: { size?: number, className?: string }) => {
  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="4" width="20" height="16" rx="3" fill="#007AFF" />
        <path d="M7 8H17V16H7V8Z" fill="white" />
        <path d="M9 10H11V12H9V10Z" fill="#007AFF" />
        <path d="M13 10H15V12H13V10Z" fill="#007AFF" />
        <path d="M9 13H11V15H9V13Z" fill="#007AFF" />
        <path d="M13 13H15V15H13V13Z" fill="#007AFF" />
      </svg>
    </div>
  );
};
