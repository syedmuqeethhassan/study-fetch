export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen flex flex-col">
      {/* Top Margin */}
      <div className="h-16 bg-gray-200 border-b border-gray-400">
        {/* Top margin area - you can add header content here later */}
      </div>
      {/* Render the page content */}
      {children}
    </div>
  );
}