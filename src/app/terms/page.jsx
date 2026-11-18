import Header from "@/components/Header";
import { FileText, AlertCircle } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#FFFDF9] text-[#241819] flex flex-col pb-20 md:pb-12">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="flex items-center gap-2 text-xs font-semibold text-stone-500 mb-6">
          <a href="/" className="hover:text-[#4A0A0F] transition-colors">Home</a>
          <span>/</span>
          <span className="text-[#4A0A0F]">Terms of Service</span>
        </div>

        <div className="rounded-3xl border border-[#EADBCC] bg-white p-8 sm:p-12 shadow-xs">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-12 w-12 rounded-2xl bg-amber-50 text-[#F97316] flex items-center justify-center">
              <FileText size={26} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#4A0A0F] tracking-tight">
                Terms &amp; Conditions of Sale
              </h1>
              <p className="text-xs text-stone-500">Last updated: November 2026 • Sri Usha Vet &amp; Pet Stores</p>
            </div>
          </div>

          <div className="prose prose-stone text-xs sm:text-sm text-stone-700 space-y-6 leading-relaxed">
            <section>
              <h2 className="text-base font-bold text-[#4A0A0F] mb-2">1. Acceptance of Terms</h2>
              <p>
                By accessing or placing an order with Sri Usha Vet &amp; Pet Stores, you agree to be bound by these Terms of Service and all applicable Indian commercial and veterinary pharmaceutical regulations.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-[#4A0A0F] mb-2">2. Veterinary Prescription Policy</h2>
              <p>
                Certain pharmaceutical products listed on this site require a valid prescription from a registered veterinary practitioner (RVP). Orders containing prescription medicines will only be dispatched after verification by our qualified pharmacist.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-[#4A0A0F] mb-2">3. Hyperlocal Delivery &amp; Timing</h2>
              <p>
                Express delivery (45–90 minutes) is provided within our designated primary service zones (Uppal, Boduppal, Habsiguda, Tarnaka, Ramanthapur). For other parts of Greater Hyderabad, same-day delivery applies for orders confirmed before 5:00 PM.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-[#4A0A0F] mb-2">4. Pricing &amp; Payments</h2>
              <p>
                All prices are stated in Indian Rupees (INR) and are inclusive of GST. Payment is accepted via Cash on Delivery (COD) or instant WhatsApp payment link.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-[#4A0A0F] mb-2">5. Returns &amp; Refunds</h2>
              <p>
                Unopened, sealed bags of pet food, accessories, and grooming products may be returned within 3 days of delivery if damaged or defective upon arrival. Opened food bags and dispensed prescription medications cannot be returned for safety and biosecurity reasons.
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
