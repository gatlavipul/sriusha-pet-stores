import Header from "@/components/Header";
import { ShieldCheck, Truck, Stethoscope, Heart, Award, MapPin, Clock, Phone, Sparkles } from "lucide-react";
import useStoreSettings from "@/utils/useStoreSettings";

export default function AboutPage() {
  const { storePhone, telUrl, whatsAppUrl } = useStoreSettings();

  return (
    <div className="min-h-screen bg-[#FFFDF9] text-[#241819] flex flex-col pb-20 md:pb-12">
      <Header />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-semibold text-stone-500 mb-6">
          <a href="/" className="hover:text-[#4A0A0F] transition-colors">Home</a>
          <span>/</span>
          <span className="text-[#4A0A0F]">About Us</span>
        </div>

        {/* Hero Banner */}
        <div className="rounded-3xl bg-gradient-to-br from-[#4A0A0F] to-[#2E0509] text-white p-8 sm:p-12 mb-10 shadow-xl relative overflow-hidden">
          <div className="relative z-10 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-xs font-bold text-[#FED7AA] mb-4 backdrop-blur-xs">
              <Sparkles size={13} />
              <span>Hyderabad&apos;s Trusted Pet Destination</span>
            </span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
              Caring for Your Pets Like Family Since Day One
            </h1>
            <p className="mt-4 text-sm sm:text-base text-stone-200 leading-relaxed">
              Sri Usha Vet &amp; Pet Stores is a dedicated veterinary pharmacy and pet nutrition hub based in Uppal, Hyderabad. We combine clinical expertise with warm, hyperlocal doorstep delivery.
            </p>
          </div>
          <div className="absolute -right-10 -bottom-10 w-72 h-72 bg-[#F97316]/10 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* Core Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="rounded-2xl border border-[#EADBCC] bg-white p-6 shadow-xs">
            <div className="h-12 w-12 rounded-xl bg-red-50 text-[#4A0A0F] flex items-center justify-center mb-4">
              <Stethoscope size={24} />
            </div>
            <h3 className="text-base font-bold text-[#4A0A0F]">Veterinary Pharmacy</h3>
            <p className="mt-2 text-xs text-stone-600 leading-relaxed">
              We stock authentic prescription pharmaceuticals, supplements, tick &amp; flea treatments, and therapeutic diets vetted by certified veterinarians.
            </p>
          </div>

          <div className="rounded-2xl border border-[#EADBCC] bg-white p-6 shadow-xs">
            <div className="h-12 w-12 rounded-xl bg-amber-50 text-[#F97316] flex items-center justify-center mb-4">
              <Truck size={24} />
            </div>
            <h3 className="text-base font-bold text-[#4A0A0F]">Express Local Delivery</h3>
            <p className="mt-2 text-xs text-stone-600 leading-relaxed">
              45–90 minute express dispatch across Uppal, Ramanthapur, Boduppal, Habsiguda, and same-day delivery throughout Greater Hyderabad.
            </p>
          </div>

          <div className="rounded-2xl border border-[#EADBCC] bg-white p-6 shadow-xs">
            <div className="h-12 w-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4">
              <ShieldCheck size={24} />
            </div>
            <h3 className="text-base font-bold text-[#4A0A0F]">100% Genuine Guarantee</h3>
            <p className="mt-2 text-xs text-stone-600 leading-relaxed">
              Every bag of food, treat pack, and pharmaceutical is sourced directly from authorized manufacturers and stored in temperature-controlled premises.
            </p>
          </div>
        </div>

        {/* Physical Store Details */}
        <div className="rounded-2xl border border-[#EADBCC] bg-stone-50 p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#F97316]">Visit Our Store</span>
            <h3 className="text-xl font-extrabold text-[#4A0A0F] mt-1">Sri Usha Vet &amp; Pet Stores</h3>
            <p className="text-xs text-stone-600 mt-2 flex items-center gap-1.5">
              <MapPin size={15} className="text-[#4A0A0F] shrink-0" />
              <span>Main Road, Uppal, Hyderabad, Telangana - 500039</span>
            </p>
            <p className="text-xs text-stone-600 mt-1 flex items-center gap-1.5">
              <Clock size={15} className="text-[#4A0A0F] shrink-0" />
              <span>Open 7 Days a Week: 9:00 AM – 9:30 PM</span>
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href={telUrl}
              className="inline-flex items-center gap-2 rounded-xl bg-[#4A0A0F] px-5 py-3 text-xs font-bold text-white shadow-xs hover:bg-[#360509] transition-all min-h-[44px]"
            >
              <Phone size={14} />
              <span>Call {storePhone}</span>
            </a>
            <a
              href={whatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-all min-h-[44px]"
            >
              <span>Chat on WhatsApp</span>
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
