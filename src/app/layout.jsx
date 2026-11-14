import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLocation } from 'react-router';
import MobileBottomNav from '@/components/MobileBottomNav';
import FloatingCartBar from '@/components/FloatingCartBar';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      cacheTime: 1000 * 60 * 30, // 30 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function RootLayout({ children }) {
  const location = useLocation();
  const pathname = location?.pathname || '';
  const isAuthPage =
    pathname.startsWith('/account/signin') ||
    pathname.startsWith('/account/signup');

  return (
    <QueryClientProvider client={queryClient}>
      <div
        className={`min-h-screen ${
          isAuthPage
            ? 'pb-0'
            : 'pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:pb-10'
        }`}
      >
        {children}
      </div>
      {!isAuthPage && <FloatingCartBar />}
      {!isAuthPage && <MobileBottomNav />}
    </QueryClientProvider>
  );
}
