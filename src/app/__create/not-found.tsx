import { useNavigate } from 'react-router';
import { Home, Search, ShoppingBag, ArrowLeft, Heart, Phone } from 'lucide-react';

type LoaderArgs = {
  params: Record<string, string | undefined>;
};

export async function loader({ params }: LoaderArgs) {
  return {
    path: `/${params['*'] || ''}`,
  };
}

export default function SriUshaNotFoundPage({
  loaderData,
}: {
  loaderData: Awaited<ReturnType<typeof loader>>;
}) {
  const navigate = useNavigate();
  const path = loaderData?.path || '';

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex flex-col justify-between text-[#0F172A]">
      {/* Top minimal branding */}
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-md px-4 py-3 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-[#2563EB] flex items-center justify-center text-white font-extrabold text-base shadow-xs">
              🐾
            </div>
            <div>
              <span className="font-extrabold text-sm text-[#0F172A] leading-tight block">Sri Usha</span>
              <span className="text-[10px] font-bold text-gray-400 block -mt-0.5">Vet &amp; Pet Stores</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-blue-600 transition-colors"
          >
            <Home size={14} />
            <span>Home</span>
          </button>
        </div>
      </header>

      {/* Main friendly 404 content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full text-center">
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-amber-50 text-amber-500 shadow-inner">
            <span className="text-5xl">🐶</span>
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 mb-3">
            <span>Error 404 • Page Not Found</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            Looks like this paw trail ended!
          </h1>

          <p className="mt-3 text-sm text-gray-600 leading-relaxed max-w-sm mx-auto">
            The page <code className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-xs font-mono">{path}</code> could not be found or has moved.
          </p>

          {/* Quick Action Navigation Grid */}
          <div className="mt-8 grid grid-cols-2 gap-3 text-left">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex items-center gap-3 p-3.5 rounded-2xl border border-gray-200 bg-white hover:border-blue-500 hover:shadow-xs transition-all"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shrink-0">
                <Home size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-900 truncate">Store Home</p>
                <p className="text-[11px] text-gray-500 truncate">Pet essentials</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => navigate('/products')}
              className="flex items-center gap-3 p-3.5 rounded-2xl border border-gray-200 bg-white hover:border-blue-500 hover:shadow-xs transition-all"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600 shrink-0">
                <Search size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-900 truncate">Search Products</p>
                <p className="text-[11px] text-gray-500 truncate">Food &amp; medicines</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => navigate('/cart')}
              className="flex items-center gap-3 p-3.5 rounded-2xl border border-gray-200 bg-white hover:border-blue-500 hover:shadow-xs transition-all"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
                <ShoppingBag size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-900 truncate">My Cart</p>
                <p className="text-[11px] text-gray-500 truncate">Review items</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => navigate('/pets')}
              className="flex items-center gap-3 p-3.5 rounded-2xl border border-gray-200 bg-white hover:border-blue-500 hover:shadow-xs transition-all"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 shrink-0">
                <Heart size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-900 truncate">Pet Passport</p>
                <p className="text-[11px] text-gray-500 truncate">Manage pets</p>
              </div>
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-center gap-4 text-xs font-medium text-gray-500">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1.5 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft size={14} />
              <span>Go Back</span>
            </button>
            <span>•</span>
            <a
              href="https://wa.me/919999999999"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-emerald-600 hover:text-emerald-700 font-semibold"
            >
              <Phone size={14} />
              <span>Need help? WhatsApp Store</span>
            </a>
          </div>
        </div>
      </main>

      {/* Footer copyright */}
      <footer className="border-t border-gray-100 py-4 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} Sri Usha Vet &amp; Pet Stores • Uppal, Hyderabad
      </footer>
    </div>
  );
}
