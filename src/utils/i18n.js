import { useState, useEffect } from "react";

export const TRANSLATIONS = {
  en: {
    freeDelivery: "Free Delivery on orders above ₹499",
    genuineVet: "100% Genuine Vet Supplies",
    searchPlaceholder: "Search pet food, veterinary medicines, treats, toys...",
    allProducts: "All Products",
    featuredProducts: "Featured Products",
    buyAgain: "Buy Again",
    account: "Account",
  },
  te: {
    freeDelivery: "₹499 పైగా ఆర్డర్లపై ఉచిత డెలివరీ",
    genuineVet: "100% అసలైన వెట్ & పెట్ ఉత్పత్తులు",
    searchPlaceholder: "పెట్ ఫుడ్, వెట్ మందులు, ట్రీట్స్ వెతకండి...",
    allProducts: "అన్ని ఉత్పత్తులు",
    featuredProducts: "ప్రత్యేక ఉత్పత్తులు",
    buyAgain: "మళ్లీ కొనండి",
    account: "ఖాతా",
  },
  hi: {
    freeDelivery: "₹499 से ऊपर के ऑर्डर पर मुफ्त डिलीवरी",
    genuineVet: "100% असली वेटरनरी और पेट उत्पाद",
    searchPlaceholder: "पेट फूड, दवाइयां, ट्रीट्स खोजें...",
    allProducts: "सभी उत्पाद",
    featuredProducts: "प्रमुख उत्पाद",
    buyAgain: "फिर से खरीदें",
    account: "खाता",
  },
};

export function useLanguage() {
  const [lang, setLang] = useState("en");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("usha_lang");
      if (saved && TRANSLATIONS[saved]) setLang(saved);
    }
  }, []);

  const changeLang = (next) => {
    if (!TRANSLATIONS[next]) return;
    setLang(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("usha_lang", next);
      window.dispatchEvent(new CustomEvent("usha-lang-change", { detail: next }));
    }
  };

  useEffect(() => {
    const handler = (e) => {
      if (e.detail && TRANSLATIONS[e.detail]) setLang(e.detail);
    };
    if (typeof window !== "undefined") {
      window.addEventListener("usha-lang-change", handler);
      return () => window.removeEventListener("usha-lang-change", handler);
    }
  }, []);

  return { lang, changeLang, t: TRANSLATIONS[lang] || TRANSLATIONS.en };
}

