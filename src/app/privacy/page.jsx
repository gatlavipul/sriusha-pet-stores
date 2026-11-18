import Header from "@/components/Header";
import { ShieldCheck, Lock } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#FFFDF9] text-[#241819] flex flex-col pb-20 md:pb-12">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="flex items-center gap-2 text-xs font-semibold text-stone-500 mb-6">
          <a href="/" className="hover:text-[#4A0A0F] transition-colors">Home</a>
          <span>/</span>
          <span className="text-[#4A0A0F]">Privacy Policy</span>
        </div>

        <div className="rounded-3xl border border-[#EADBCC] bg-white p-8 sm:p-12 shadow-xs">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <ShieldCheck size={26} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#4A0A0F] tracking-tight">
                Privacy &amp; Data Protection Policy
              </h1>
              <p className="text-xs text-stone-500">Effective Date: November 2026 • Sri Usha Vet &amp; Pet Stores</p>
            </div>
          </div>

          <div className="prose prose-stone text-xs sm:text-sm text-stone-700 space-y-6 leading-relaxed">
            <section>
              <h2 className="text-base font-bold text-[#4A0A0F] mb-2">1. Overview &amp; Commitment</h2>
              <p>
                Sri Usha Vet &amp; Pet Stores (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) operates the pet care and veterinary storefront at sriushapetstore.netlify.app. We are committed to safeguarding the privacy and personal data of our customers, pet owners, and delivery recipients in accordance with the Digital Personal Data Protection (DPDP) Act of India.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-[#4A0A0F] mb-2">2. Information We Collect</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Account Credentials:</strong> Name, email address, and phone number secured via Clerk Authentication.</li>
                <li><strong>Delivery Addresses:</strong> Street address, landmarks, city, and pincode used solely for dispatching your orders in Hyderabad.</li>
                <li><strong>Pet Profiles:</strong> Pet names, species, breed, age, and dietary preferences you save in your Pet Health Hub.</li>
                <li><strong>Veterinary Prescriptions:</strong> Images or PDF prescriptions you upload to verify Schedule H veterinary pharmaceuticals.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-bold text-[#4A0A0F] mb-2">3. Prescription Confidentiality</h2>
              <p>
                Veterinary prescriptions uploaded to Sri Usha Pet Stores are reviewed strictly by our authorized pharmacists to verify medication authenticity and dosage safety. Prescription files are never shared with third parties or sold for advertising.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-[#4A0A0F] mb-2">4. Payment Security</h2>
              <p>
                We do not store or process payment card details or UPI PINs on our servers. All transactions are handled securely through certified payment gateways or in cash upon physical doorstep delivery.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-[#4A0A0F] mb-2">5. Contact Information</h2>
              <p>
                If you have questions regarding this Privacy Policy or wish to delete your account data, please contact us at:
                <br />
                <strong>Sri Usha Vet &amp; Pet Stores</strong>
                <br />
                Main Road, Uppal, Hyderabad, Telangana - 500039
                <br />
                Phone: +91 94402 74418
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
