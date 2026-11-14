import { useNavigate } from 'react-router';
import { Home, Search, ShoppingBag, ArrowLeft, Heart, Phone, Dog } from 'lucide-react';

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
    <div className="min-h-screen bg-[#FAF7F2] flex flex-col justify-between text-[#241819]">
      {/* Top minimal branding with logo-full */}
      <header className="border-b border-[#EADBCC] bg-[#FFFDF9]/90 backdrop-blur-md px-4 py-3 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <a href="/" className="inline-block" aria-label="Sri Usha Home">
            <img
              src="/brand/logo-full.webp"
              onError={(e) => {
                e.currentTarget.src = "/brand/logo-full.png";
              }}
              alt="Sri Usha Vet & Pet Stores"
              width={160}
              height={48}
              className="h-10 w-auto object-contain"
            />
          </a>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4A0A0F] hover:text-[#F97316] transition-colors"
            aria-label="Return to store home"
          >
            <Home size={15} strokeWidth={2} />
            <span>Home</span>
          </button>
        </div>
      </header>

      {/* Main friendly 404 content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full text-center">
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-[#FFF7ED] text-[#F97316] shadow-inner border border-[#FED7AA]">
            <Dog size={48} strokeWidth={1.75} className="text-[#F97316]" />
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF7ED] border border-[#FED7AA] px-3 py-1 text-xs font-bold text-[#F97316] mb-3">
            <span>Error 404 • Page Not Found</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#4A0A0F] tracking-tight">
            Looks like this trail ended!
          </h1>

          <p className="mt-3 text-sm text-stone-600 leading-relaxed max-w-sm mx-auto">
            The page <code className="bg-stone-200/70 text-[#4A0A0F] px-1.5 py-0.5 rounded text-xs font-mono">{path}</code> could not be found or has moved.
          </p>

          {/* Quick Action Navigation Grid */}
          <div className="mt-8 grid grid-cols-2 gap-3 text-left">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex items-center gap-3 p-3.5 rounded-2xl border border-[#EADBCC] bg-white hover:border-[#F97316] hover:shadow-xs transition-all"
              aria-label="Go to Store Home"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF7ED] text-[#F97316] shrink-0">
                <Home size={18} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#4A0A0F] truncate">Store Home</p>
                <p className="text-[11px] text-stone-500 truncate">Pet essentials</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => navigate('/products')}
              className="flex items-center gap-3 p-3.5 rounded-2xl border border-[#EADBCC] bg-white hover:border-[#F97316] hover:shadow-xs transition-all"
              aria-label="Search Products"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FEFCE8] text-[#D97706] shrink-0">
                <Search size={18} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#4A0A0F] truncate">Search Products</p>
                <p className="text-[11px] text-stone-500 truncate">Food &amp; care</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => navigate('/cart')}
              className="flex items-center gap-3 p-3.5 rounded-2xl border border-[#EADBCC] bg-white hover:border-[#F97316] hover:shadow-xs transition-all"
              aria-label="View Shopping Cart"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 shrink-0">
                <ShoppingBag size={18} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#4A0A0F] truncate">My Cart</p>
                <p className="text-[11px] text-stone-500 truncate">Review items</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => navigate('/pets')}
              className="flex items-center gap-3 p-3.5 rounded-2xl border border-[#EADBCC] bg-white hover:border-[#F97316] hover:shadow-xs transition-all"
              aria-label="Open Pet Passport"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-[#4A0A0F] shrink-0">
                <Heart size={18} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#4A0A0F] truncate">Pet Passport</p>
                <p className="text-[11px] text-stone-500 truncate">Manage pets</p>
              </div>
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-[#EADBCC] flex items-center justify-center gap-4 text-xs font-medium text-stone-500">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1.5 hover:text-[#4A0A0F] transition-colors"
              aria-label="Go Back"
            >
              <ArrowLeft size={14} />
              <span>Go Back</span>
            </button>
            <span>•</span>
            <a
              href="https://wa.me/919999999999"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-emerald-700 hover:text-emerald-800 font-semibold"
              aria-label="Contact store on WhatsApp"
            >
              <Phone size={14} />
              <span>WhatsApp Store</span>
            </a>
          </div>
        </div>
      </main>

      {/* Footer copyright with full logo */}
      <footer className="border-t border-[#EADBCC] py-6 bg-[#FFFDF9] text-center">
        <div className="max-w-md mx-auto flex flex-col items-center gap-2 px-4">
          <img
            src="/brand/logo-full.webp"
            onError={(e) => {
              e.currentTarget.src = "/brand/logo-full.png";
            }}
            alt="Sri Usha"
            width={120}
            height={36}
            className="h-8 w-auto object-contain opacity-85"
          />
          <p className="text-xs text-stone-500">
            © {new Date().getFullYear()} Sri Usha Vet &amp; Pet Stores • Uppal, Hyderabad
          </p>
        </div>
      </footer>
    </div>
  );
}
