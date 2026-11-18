import { useState } from "react";
import Header from "@/components/Header";
import { MapPin, Phone, Mail, Clock, MessageSquare, Send, CheckCircle2 } from "lucide-react";
import useStoreSettings from "@/utils/useStoreSettings";

export default function ContactPage() {
  const { storePhone, telUrl, whatsAppUrl } = useStoreSettings();
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({ name: "", phone: "", message: "" });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) return;
    // Redirect to WhatsApp with prefilled message
    const msg = `Hi Sri Usha Pet Store, my name is ${formData.name} (${formData.phone}). ${formData.message}`;
    window.open(`https://wa.me/919440274418?text=${encodeURIComponent(msg)}`, "_blank");
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#FFFDF9] text-[#241819] flex flex-col pb-20 md:pb-12">
      <Header />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-semibold text-stone-500 mb-6">
          <a href="/" className="hover:text-[#4A0A0F] transition-colors">Home</a>
          <span>/</span>
          <span className="text-[#4A0A0F]">Contact Us</span>
        </div>

        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#4A0A0F] tracking-tight">
            Get in Touch with Sri Usha Pet Store
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-stone-600">
            Have questions about pet medications, specialized nutrition, or same-day Hyderabad delivery? We are here to help.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Store Info Cards */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#EADBCC] bg-white p-6 shadow-xs">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-xl bg-red-50 text-[#4A0A0F] flex items-center justify-center shrink-0">
                  <MapPin size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#4A0A0F]">Store Location</h3>
                  <p className="mt-1 text-xs text-stone-600 leading-relaxed">
                    Sri Usha Vet &amp; Pet Stores<br />
                    Main Road, Uppal,<br />
                    Hyderabad, Telangana - 500039
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#EADBCC] bg-white p-6 shadow-xs">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-xl bg-amber-50 text-[#F97316] flex items-center justify-center shrink-0">
                  <Phone size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#4A0A0F]">Phone &amp; WhatsApp</h3>
                  <p className="mt-1 text-xs text-stone-600">
                    Direct Store Line: <a href={telUrl} className="font-bold text-[#4A0A0F] hover:underline">{storePhone}</a>
                  </p>
                  <p className="mt-1 text-xs text-stone-600">
                    Instant WhatsApp: <a href={whatsAppUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-emerald-700 hover:underline">+91 94402 74418</a>
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#EADBCC] bg-white p-6 shadow-xs">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                  <Clock size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#4A0A0F]">Working Hours</h3>
                  <p className="mt-1 text-xs text-stone-600 leading-relaxed">
                    Monday to Sunday: 9:00 AM – 9:30 PM<br />
                    Express Dispatch: 10:00 AM – 8:30 PM Daily
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Message Form */}
          <div className="rounded-2xl border border-[#EADBCC] bg-white p-6 sm:p-8 shadow-xs">
            <h3 className="text-base font-bold text-[#4A0A0F] mb-1">Send Us a Direct Message</h3>
            <p className="text-xs text-stone-500 mb-5">
              Leave your inquiry below to connect with our veterinary support team on WhatsApp.
            </p>

            {submitted ? (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-6 text-center">
                <CheckCircle2 size={36} className="mx-auto text-emerald-600 mb-2" />
                <h4 className="text-sm font-bold text-emerald-800">Inquiry Initiated!</h4>
                <p className="text-xs text-emerald-700 mt-1">
                  We opened WhatsApp so you can chat directly with our staff.
                </p>
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="mt-4 text-xs font-bold text-emerald-800 underline"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Your Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Ramesh Reddy"
                    className="w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-xs text-stone-900 focus:border-[#F97316] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="e.g. 9876543210"
                    className="w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-xs text-stone-900 focus:border-[#F97316] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Message / Prescription Question</label>
                  <textarea
                    rows={4}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Ask about dog foods, prescription availability, or delivery pin codes..."
                    className="w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-xs text-stone-900 focus:border-[#F97316] focus:outline-hidden"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#4A0A0F] px-5 py-3 text-xs font-bold text-white shadow-xs hover:bg-[#360509] transition-all min-h-[44px]"
                >
                  <Send size={14} />
                  <span>Connect with Vet Support</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
