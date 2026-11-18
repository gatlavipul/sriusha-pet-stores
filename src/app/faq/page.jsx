import Header from "@/components/Header";
import { HelpCircle, ChevronDown, Truck, CreditCard, Stethoscope, Clock } from "lucide-react";
import useStoreSettings from "@/utils/useStoreSettings";

const FAQS = [
  {
    q: "How fast is delivery in Hyderabad?",
    a: "Orders placed within our local hub zones (Uppal, Boduppal, Ramanthapur, Habsiguda) are dispatched within 45 to 90 minutes. For areas like Secunderabad, Banjara Hills, and Hitec City, orders are delivered same-day in 2 to 5 hours.",
  },
  {
    q: "Do I need a prescription to buy medicines?",
    a: "Routine food, treats, supplements, grooming products, and basic tick/flea collars do not require a prescription. However, Schedule H veterinary antibiotics, anti-inflammatories, and cardiac medications require a prescription from a registered vet.",
  },
  {
    q: "What payment methods are supported?",
    a: "We accept Cash on Delivery (COD) as well as direct UPI/QR code payment directly to our delivery executive upon arrival. You can also complete your order directly via WhatsApp with our store manager.",
  },
  {
    q: "Where is Sri Usha Pet Store located?",
    a: "Our physical retail store and pharmacy is situated on Main Road, Uppal, Hyderabad, Telangana - 500039. You are welcome to visit us in person between 9:00 AM and 9:30 PM daily.",
  },
  {
    q: "Is there a minimum order for free delivery?",
    a: "Yes, delivery is completely free for orders above ₹300 to ₹500 depending on your distance from our Uppal store hub. For orders below the threshold, a nominal delivery fee of ₹30 to ₹50 applies.",
  },
];

export default function FAQPage() {
  const { storePhone, telUrl, whatsAppUrl } = useStoreSettings();

  return (
    <div className="min-h-screen bg-[#FFFDF9] text-[#241819] flex flex-col pb-20 md:pb-12">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="flex items-center gap-2 text-xs font-semibold text-stone-500 mb-6">
          <a href="/" className="hover:text-[#4A0A0F] transition-colors">Home</a>
          <span>/</span>
          <span className="text-[#4A0A0F]">Frequently Asked Questions</span>
        </div>

        <div className="text-center max-w-xl mx-auto mb-10">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF7ED] text-[#F97316] mb-3">
            <HelpCircle size={24} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#4A0A0F] tracking-tight">
            Frequently Asked Questions
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-stone-600">
            Everything you need to know about shopping, pet prescriptions, and express delivery in Hyderabad.
          </p>
        </div>

        <div className="space-y-4 mb-12">
          {FAQS.map((faq, idx) => (
            <div key={idx} className="rounded-2xl border border-[#EADBCC] bg-white p-6 shadow-xs">
              <h3 className="text-sm font-bold text-[#4A0A0F] mb-2">{faq.q}</h3>
              <p className="text-xs text-stone-600 leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>

        {/* Still have questions */}
        <div className="rounded-2xl border border-[#FED7AA] bg-[#FFF7ED] p-6 text-center">
          <h3 className="text-sm font-bold text-[#4A0A0F]">Have a question not answered here?</h3>
          <p className="mt-1 text-xs text-stone-600">
            Our veterinary pharmacist and customer care team are available every day.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <a
              href={telUrl}
              className="inline-flex items-center gap-2 rounded-xl bg-[#4A0A0F] px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#360509]"
            >
              Call {storePhone}
            </a>
            <a
              href={whatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
            >
              Ask on WhatsApp
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
