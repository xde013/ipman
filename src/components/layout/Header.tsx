interface HeaderProps {
  showClearAll: boolean;
  onClearAll: () => void;
}

export function Header({ showClearAll, onClearAll }: HeaderProps) {
  return (
    <header className="flex items-center gap-4 px-6 py-3 bg-white border-b border-gray-200 shadow-sm">
      <h1 className="text-2xl font-bold text-indigo-500">Ipman</h1>
      <p className="text-sm text-gray-500">
        Drag to create a region, then describe the UI you want
      </p>
      {showClearAll && (
        <button
          onClick={onClearAll}
          className="ml-auto px-4 py-2 text-sm font-medium text-red-500 bg-transparent border border-red-500 rounded transition-colors hover:bg-red-500 hover:text-white"
        >
          Clear All
        </button>
      )}
    </header>
  );
}
