'use client';

import { useRouter } from 'next/navigation';

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        // Redirect to login page after successful logout
        router.push('/login');
      } else {
        console.error('Logout failed');
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };
  return (
    <div className="h-screen flex flex-col">
      {/* Navigation Bar */}
      <nav className="h-16 bg-white border-b border-gray-300 shadow-sm">
        <div className="h-full flex items-center justify-between px-6">
          {/* Left side - Logo/Title */}
          <div className="flex items-center">
            <h1 className="text-xl font-semibold text-gray-800">Study Fetch</h1>
          </div>
          
          {/* Right side - Navigation buttons */}
          <div className="flex items-center space-x-4">
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              <span>🚪</span>
              Logout
            </button>
          </div>
        </div>
      </nav>
      
      {/* Render the page content */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}