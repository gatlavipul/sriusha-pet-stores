import { useState, useEffect } from "react";

const DEFAULT_STORE_PHONE = "+91 94402 74418";

let cachedSettings = null;
let fetchPromise = null;

export function formatCleanPhone(phone) {
  if (!phone) return "919440274418";
  return phone.replace(/[^0-9]/g, "");
}

export default function useStoreSettings() {
  const [settings, setSettings] = useState(
    cachedSettings || { store_phone: DEFAULT_STORE_PHONE }
  );

  useEffect(() => {
    if (cachedSettings) {
      setSettings(cachedSettings);
      return;
    }

    if (!fetchPromise) {
      fetchPromise = fetch("/api/settings")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.settings) {
            cachedSettings = data.settings;
            return data.settings;
          }
          return { store_phone: DEFAULT_STORE_PHONE };
        })
        .catch(() => ({ store_phone: DEFAULT_STORE_PHONE }));
    }

    fetchPromise.then((s) => {
      setSettings(s);
    });
  }, []);

  const storePhone = settings?.store_phone || DEFAULT_STORE_PHONE;
  const digitsOnly = formatCleanPhone(storePhone);
  const telUrl = `tel:+${digitsOnly}`;
  const whatsAppUrl = `https://wa.me/${digitsOnly}`;

  return {
    settings,
    storePhone,
    digitsOnly,
    telUrl,
    whatsAppUrl,
  };
}

