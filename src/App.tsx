import logo from "./assets/logo.png";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";

declare global {
  interface Window {
    google: any;
  }
}

const GOOGLE_CLIENT_ID =
  "447699234633-ivo2e1c2q843scj32k5323o2rkq6h7dp.apps.googleusercontent.com";

const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbzXgEiKY68xVN-qtwRofMTNdKxr-6HOR835vsJafxcE22HfFIh1UhLTeu_I0rYhe2klIQ/exec";

const TOTAL_STEPS = 9;

type AvailabilitySlot = {
  date: string;
  time: string;
  available?: boolean;
  notes?: string;
};

type VehicleType = "truckSuv" | "sedan" | "coupe" | "boat" | "";
type PackageType = "basic" | "premium" | "";
type ServiceType = "mobile" | "dropoff" | "";
type ClientType = "oneTime" | "maintenance" | "";
type FrequencyType = "biweekly" | "monthly" | "";

type AddOn =
  | "Headlight Restoration"
  | "Stain Removal"
  | "Paint Correction"
  | "Pet Hair Removal"
  | "Steam Cleaning"
  | "Ceramic Coating"
  | "Oxidation Removal"
  | "Gelcoat Polishing"
  | "Wet Sanding"
  | "Interior Deep Extraction"
  | "Sealant & Protection Upgrade";

type GoogleUser = {
  name: string;
  email: string;
  picture: string;
};

type Booking = {
  date: string;
  time: string;
  year: string;
  make: string;
  model: string;
  boatSize: string;
  vehicle: string;
  packageType: string;
  hourlyRate: string;
  addOns: string;
  serviceType: string;
  address: string;
  avgTime: string;
  notes: string;
  clientType: string;
  recurringFrequency: string;
  status: string;
};

const vehicleOptions = [
  { id: "truckSuv" as VehicleType, label: "Truck / SUV", basicRate: 80, premiumRate: 100 },
  { id: "sedan"    as VehicleType, label: "Sedan",        basicRate: 70, premiumRate: 90  },
  { id: "coupe"    as VehicleType, label: "Coupe",        basicRate: 65, premiumRate: 85  },
  { id: "boat"     as VehicleType, label: "Boat",         basicRate: 90, premiumRate: 110 },
];

const addOnOptions: { label: AddOn; priceText: string; fixedPrice?: number }[] = [
  { label: "Headlight Restoration", priceText: "$150", fixedPrice: 150 },
  { label: "Stain Removal",         priceText: "Need consultation" },
  { label: "Paint Correction",      priceText: "Need consultation" },
  { label: "Pet Hair Removal",      priceText: "$60",  fixedPrice: 60  },
  { label: "Steam Cleaning",        priceText: "$60",  fixedPrice: 60  },
  { label: "Ceramic Coating",       priceText: "Need consultation" },
];

const marineAddOnOptions: { label: AddOn; priceText: string; fixedPrice?: number }[] = [
  { label: "Oxidation Removal",            priceText: "Need consultation" },
  { label: "Gelcoat Polishing",            priceText: "Need consultation" },
  { label: "Wet Sanding",                  priceText: "Need consultation" },
  { label: "Interior Deep Extraction",     priceText: "$120", fixedPrice: 120 },
  { label: "Sealant & Protection Upgrade", priceText: "$80",  fixedPrice: 80  },
];

function formatDateLabel(dateStr: string) {
  if (!dateStr) return "N/A";
  const parts = dateStr.includes("-") ? dateStr.split("-").map(Number) : null;
  if (!parts) return dateStr;
  const [y, m, d] = parts;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(value);
}

function isUpcoming(dateStr: string) {
  if (!dateStr) return false;
  const parts = dateStr.includes("-") ? dateStr.split("-").map(Number) : null;
  if (!parts) return false;
  const [y, m, d] = parts;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return new Date(y, m - 1, d) >= today;
}

async function fetchAllAvailability(): Promise<AvailabilitySlot[]> {
  const res = await fetch(`${SCRIPT_URL}?action=getAllAvailability`);
  const data: { slots: AvailabilitySlot[] } = await res.json();
  return data.slots || [];
}

async function fetchBookingsForEmail(email: string): Promise<Booking[]> {
  const res = await fetch(`${SCRIPT_URL}?action=getBookingsByEmail&email=${encodeURIComponent(email)}`);
  const data: { bookings: Booking[] } = await res.json();
  return data.bookings || [];
}

function BookingCard({ booking, upcoming, onRequestChange }: {
  booking: Booking; upcoming: boolean; onRequestChange: (b: Booking) => void;
}) {
  const vehicleLabel =
    booking.vehicle === "boat"
      ? [booking.boatSize, booking.make, booking.model].filter(Boolean).join(" ")
      : [booking.year, booking.make, booking.model].filter(Boolean).join(" ");

  return (
    <div style={{ background: "#fff", border: upcoming ? "1.5px solid #2563eb" : "1px solid #e5e7eb", borderRadius: 16, padding: 18, position: "relative" as const }}>
      {upcoming && (
        <span style={{ position: "absolute" as const, top: 14, right: 14, background: "#eff6ff", color: "#2563eb", fontSize: "0.75rem", fontWeight: 700, borderRadius: 999, padding: "3px 10px" }}>
          UPCOMING
        </span>
      )}
      <div style={{ fontSize: "1rem", fontWeight: 700, color: "#111827", marginBottom: 4 }}>
        {formatDateLabel(booking.date)}{booking.time ? ` at ${booking.time}` : ""}
      </div>
      <div style={{ fontSize: "0.92rem", color: "#6b7280", lineHeight: 1.6 }}>
        {vehicleLabel && <div>{vehicleLabel}</div>}
        <div>{booking.packageType === "basic" ? "Basic Detail" : booking.packageType === "premium" ? "Premium Detail" : booking.packageType}</div>
        {booking.serviceType && (
          <div>{booking.serviceType === "mobile" ? `Mobile Service${booking.address ? ` - ${booking.address}` : ""}` : "Drop-Off Service"}</div>
        )}
        {booking.addOns && <div>Add-Ons: {booking.addOns}</div>}
        {booking.notes && <div>Notes: {booking.notes}</div>}
      </div>
      {upcoming && (
        <button onClick={() => onRequestChange(booking)} style={{ marginTop: 14, background: "#111827", color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontSize: "0.9rem", fontWeight: 600, cursor: "pointer" }}>
          Request a Change
        </button>
      )}
    </div>
  );
}

function MaintenanceCard({ booking, onRequestChange }: {
  booking: Booking; onRequestChange: (b: Booking) => void;
}) {
  const vehicleLabel =
    booking.vehicle === "boat"
      ? [booking.boatSize, booking.make, booking.model].filter(Boolean).join(" ")
      : [booking.year, booking.make, booking.model].filter(Boolean).join(" ");

  const freqLabel =
    booking.recurringFrequency === "biweekly" ? "Bi-Weekly"
    : booking.recurringFrequency === "monthly" ? "Monthly"
    : booking.recurringFrequency || "Recurring";

  const upcoming = isUpcoming(booking.date);

  return (
    <div style={{ background: "#fff", border: "1.5px solid #059669", borderRadius: 16, padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
        <div style={{ fontSize: "1rem", fontWeight: 700, color: "#111827", flex: 1, minWidth: 0 }}>
          {formatDateLabel(booking.date)}{booking.time ? ` at ${booking.time}` : ""}
        </div>
        <span style={{ background: "#ecfdf5", color: "#059669", fontSize: "0.72rem", fontWeight: 700, borderRadius: 999, padding: "3px 9px", whiteSpace: "nowrap" as const, flexShrink: 0 }}>
          {freqLabel.toUpperCase()}
        </span>
      </div>
      <div style={{ fontSize: "0.92rem", color: "#6b7280", lineHeight: 1.6 }}>
        {vehicleLabel && <div>{vehicleLabel}</div>}
        <div>{booking.packageType === "basic" ? "Basic Detail" : booking.packageType === "premium" ? "Premium Detail" : booking.packageType}</div>
        {booking.serviceType && (
          <div>{booking.serviceType === "mobile" ? `Mobile Service${booking.address ? ` - ${booking.address}` : ""}` : "Drop-Off Service"}</div>
        )}
        {booking.addOns && <div>Add-Ons: {booking.addOns}</div>}
        {booking.notes && <div>Notes: {booking.notes}</div>}
      </div>
      {upcoming && (
        <button onClick={() => onRequestChange(booking)} style={{ marginTop: 14, background: "#059669", color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontSize: "0.9rem", fontWeight: 600, cursor: "pointer" }}>
          Request a Change
        </button>
      )}
    </div>
  );
}

export default function App() {
  const addressInputRef = useRef(null);

  const [googleUser, setGoogleUser]                     = useState<GoogleUser | null>(null);
  const [googleScriptLoaded, setGoogleScriptLoaded]     = useState(false);
  const [view, setView]                                 = useState<"booking" | "myBookings" | "requestChange">("booking");
  const [bookingsTab, setBookingsTab]                   = useState<"appointments" | "maintenance">("appointments");
  const [userBookings, setUserBookings]                 = useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading]           = useState(false);
  const [changeTarget, setChangeTarget]                 = useState<Booking | null>(null);
  const [changeNote, setChangeNote]                     = useState("");
  const [changeSubmitted, setChangeSubmitted]           = useState(false);
  const [changeSubmitting, setChangeSubmitting]         = useState(false);
  const [step, setStep]                                 = useState(0);
  const [vehicle, setVehicle]                           = useState<VehicleType>("");
  const [clientType, setClientType]                     = useState<ClientType>("");
  const [frequency, setFrequency]                       = useState<FrequencyType>("");
  const [pkg, setPkg]                                   = useState<PackageType>("");
  const [addOns, setAddOns]                             = useState<AddOn[]>([]);
  const [serviceType, setServiceType]                   = useState<ServiceType>("");
  const [name, setName]                                 = useState("");
  const [phone, setPhone]                               = useState("");
  const [email, setEmail]                               = useState("");
  const [year, setYear]                                 = useState("");
  const [make, setMake]                                 = useState("");
  const [model, setModel]                               = useState("");
  const [boatMake, setBoatMake]                         = useState("");
  const [boatModel, setBoatModel]                       = useState("");
  const [boatSize, setBoatSize]                         = useState("");
  const [bookingNotes, setBookingNotes]                 = useState("");
  const [selectedDate, setSelectedDate]                 = useState("");
  const [availableSlots, setAvailableSlots]             = useState<AvailabilitySlot[]>([]);
  const [allAvailableSlots, setAllAvailableSlots]       = useState<AvailabilitySlot[]>([]);
  const [availableDates, setAvailableDates]             = useState<string[]>([]);
  const [selectedTime, setSelectedTime]                 = useState("");
  const [address, setAddress]                           = useState("");
  const [street, setStreet]                             = useState("");
  const [city, setCity]                                 = useState("");
  const [stateRegion, setStateRegion]                   = useState("");
  const [zip, setZip]                                   = useState("");
  const [placeId, setPlaceId]                           = useState("");
  const [lat, setLat]                                   = useState("");
  const [lng, setLng]                                   = useState("");
  const [addressSelected, setAddressSelected]           = useState(false);
  const [makeOptions, setMakeOptions]                   = useState<string[]>([]);
  const [modelOptions, setModelOptions]                 = useState<string[]>([]);
  const [loadingMakes, setLoadingMakes]                 = useState(false);
  const [loadingModels, setLoadingModels]               = useState(false);

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: currentYear - 1995 + 1 }, (_, i) => String(currentYear - i));

  useEffect(() => {
    if (document.getElementById("google-gsi-script")) { setGoogleScriptLoaded(true); return; }
    const script = document.createElement("script");
    script.id = "google-gsi-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true; script.defer = true;
    script.onload = () => setGoogleScriptLoaded(true);
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (!googleScriptLoaded || googleUser) return;
    if (!window.google?.accounts?.id) return;
    window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredential });
    const btnEl = document.getElementById("google-signin-btn");
    if (btnEl) window.google.accounts.id.renderButton(btnEl, { theme: "outline", size: "large", shape: "rectangular", text: "signin_with", logo_alignment: "left" });
  }, [googleScriptLoaded, googleUser, view, step]);

  function handleGoogleCredential(response: any) {
    try {
      const payload = JSON.parse(atob(response.credential.split(".")[1]));
      setGoogleUser({ name: payload.name || "", email: payload.email || "", picture: payload.picture || "" });
      setEmail(payload.email || "");
    } catch (e) { console.error("Google sign-in error", e); }
  }

  function handleSignOut() {
    if (window.google?.accounts?.id) window.google.accounts.id.disableAutoSelect();
    setGoogleUser(null); setEmail(""); setView("booking"); setUserBookings([]);
  }

  const loadMyBookings = useCallback(async () => {
    if (!googleUser) return;
    setBookingsLoading(true);
    try {
      const bookings = await fetchBookingsForEmail(googleUser.email);
      setUserBookings(bookings);
    } catch (e) { console.error("Failed to load bookings", e); }
    finally { setBookingsLoading(false); }
  }, [googleUser]);

  function openMyBookings() {
    setView("myBookings"); setBookingsTab("appointments"); loadMyBookings();
  }

  useEffect(() => {
    const load = async () => {
      try {
        setLoadingMakes(true);
        const t = vehicle === "truckSuv" ? "truck" : "car";
        const res = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/GetMakesForVehicleType/${t}?format=json`);
        const data = await res.json();
        setMakeOptions(data.Results?.map((i: any) => i.MakeName || i.Make_Name).filter(Boolean).sort((a: string, b: string) => a.localeCompare(b)) || []);
      } catch { setMakeOptions([]); }
      finally { setLoadingMakes(false); }
    };
    if (vehicle && vehicle !== "boat") { load(); } else { setMakeOptions([]); }
  }, [vehicle]);

  useEffect(() => {
    const load = async () => {
      if (!year || !make || !vehicle || vehicle === "boat") { setModelOptions([]); return; }
      try {
        setLoadingModels(true);
        const t = vehicle === "truckSuv" ? "truck" : "car";
        const res = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/${encodeURIComponent(make)}/modelyear/${year}/vehicletype/${t}?format=json`);
        const data = await res.json();
        setModelOptions(data.Results?.map((i: any) => i.Model_Name).filter(Boolean).sort((a: string, b: string) => a.localeCompare(b)) || []);
      } catch { setModelOptions([]); }
      finally { setLoadingModels(false); }
    };
    load();
  }, [year, make, vehicle]);

  useEffect(() => {
    if (step !== 5 || serviceType !== "mobile") return;
    if (!window.google?.maps?.places || !addressInputRef.current) return;
    const ac = new window.google.maps.places.Autocomplete(addressInputRef.current, {
      types: ["address"], componentRestrictions: { country: "us" },
      fields: ["address_components", "formatted_address", "geometry", "place_id"],
    });
    const listener = ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      if (!place?.address_components) return;
      let sn = "", rt = "", loc = "", aa = "", pc = "";
      place.address_components.forEach((c: any) => {
        if (c.types.includes("street_number")) sn = c.long_name;
        if (c.types.includes("route")) rt = c.long_name;
        if (c.types.includes("locality")) loc = c.long_name;
        if (c.types.includes("administrative_area_level_1")) aa = c.short_name;
        if (c.types.includes("postal_code")) pc = c.long_name;
      });
      setAddress(place.formatted_address || "");
      setStreet([sn, rt].filter(Boolean).join(" "));
      setCity(loc); setStateRegion(aa); setZip(pc);
      setPlaceId(place.place_id || "");
      setLat(place.geometry?.location?.lat?.() ?? "");
      setLng(place.geometry?.location?.lng?.() ?? "");
      setAddressSelected(true);
    });
    return () => { if (listener) window.google.maps.event.removeListener(listener); };
  }, [step, serviceType]);

  useEffect(() => {
    fetchAllAvailability().then((slots) => {
      setAllAvailableSlots(slots);
      setAvailableDates([...new Set(slots.map((s) => s.date))]);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedDate) { setAvailableSlots([]); return; }
    setAvailableSlots(allAvailableSlots.filter((s) => s.date === selectedDate));
  }, [selectedDate, allAvailableSlots]);

  const selectedVehicle = vehicleOptions.find((v) => v.id === vehicle);

  const hourlyRate = useMemo(() => {
    if (!selectedVehicle || !pkg) return 0;
    return pkg === "basic" ? selectedVehicle.basicRate : selectedVehicle.premiumRate;
  }, [selectedVehicle, pkg]);

  const packageHours = useMemo(() => {
    if (!vehicle || !pkg) return "Select vehicle first";
    if (vehicle === "boat") return pkg === "premium" ? "5-8 hours avg" : "3-6 hours avg";
    if (vehicle === "truckSuv") return "3-5 hours avg";
    return pkg === "premium" ? "3-5 hours avg" : "3-4 hours avg";
  }, [vehicle, pkg]);

  const addOnEstimate = useMemo(() => {
    const all = [...addOnOptions, ...marineAddOnOptions];
    return addOns.reduce((sum, a) => sum + (all.find((o) => o.label === a)?.fixedPrice ?? 0), 0);
  }, [addOns]);

  const estimateText     = useMemo(() => hourlyRate ? `${formatCurrency(hourlyRate)}/hr` : "", [hourlyRate]);
  const addOnSummaryText = useMemo(() => addOns.join(", "), [addOns]);

  function toggleAddOn(addOn: AddOn) {
    setAddOns((prev) => prev.includes(addOn) ? prev.filter((i) => i !== addOn) : [...prev, addOn]);
  }
  function next() { setStep((s) => s + 1); }
  function back() { setStep((s) => s - 1); }

  const vehicleSummary =
    vehicle === "boat"
      ? [boatSize, boatMake, boatModel].filter(Boolean).join(" ") || "N/A"
      : [year, make, model].filter(Boolean).join(" ") || "N/A";

  const step6Disabled =
    !name || !phone || !email || !selectedDate || !selectedTime ||
    (vehicle === "boat" ? !boatSize || !boatMake || !boatModel : !year || !make || !model);

  const standardBookings    = userBookings.filter((b) => b.clientType !== "maintenance");
  const maintenanceBookings = userBookings.filter((b) => b.clientType === "maintenance");
  const isMaintenance       = maintenanceBookings.length > 0;
  const upcomingStandard    = standardBookings.filter((b) => isUpcoming(b.date)).sort((a, b) => a.date.localeCompare(b.date));
  const pastStandard        = standardBookings.filter((b) => !isUpcoming(b.date)).sort((a, b) => b.date.localeCompare(a.date));
  const upcomingMaintenance = maintenanceBookings.filter((b) => isUpcoming(b.date)).sort((a, b) => a.date.localeCompare(b.date));
  const pastMaintenance     = maintenanceBookings.filter((b) => !isUpcoming(b.date)).sort((a, b) => b.date.localeCompare(a.date));

  async function submitChangeRequest() {
    if (!changeTarget || !changeNote.trim()) return;
    setChangeSubmitting(true);
    try {
      const vl = changeTarget.vehicle === "boat"
        ? [changeTarget.boatSize, changeTarget.make, changeTarget.model].filter(Boolean).join(" ")
        : [changeTarget.year, changeTarget.make, changeTarget.model].filter(Boolean).join(" ");
      await fetch(SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "requestChange",
          customerEmail: googleUser?.email || "",
          customerName: googleUser?.name || "",
          bookingDate: changeTarget.date,
          bookingTime: changeTarget.time,
          vehicle: vl,
          packageType: changeTarget.packageType,
          changeNote,
        }),
      });
      setChangeSubmitted(true);
    } catch (e) { console.error("Change request failed", e); }
    finally { setChangeSubmitting(false); }
  }

  const S = {
    page:           { minHeight: "100vh", background: "linear-gradient(180deg,#f7f7f8 0%,#efeff1 100%)", color: "#171717", padding: "32px 16px", fontFamily: 'Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' } as const,
    container:      { maxWidth: 920, margin: "0 auto" } as const,
    card:           { background: "rgba(255,255,255,0.96)", border: "1px solid #e5e7eb", borderRadius: 24, boxShadow: "0 18px 45px rgba(17,24,39,0.08)", padding: 28 } as const,
    title:          { fontSize: "2.4rem", fontWeight: 800, letterSpacing: "-1px", color: "#111827", margin: "0 0 14px", textAlign: "center" as const },
    subtitle:       { fontSize: "1rem", color: "#6b7280", margin: "0 0 28px", textAlign: "center" as const },
    primary:        { background: "#111827", color: "#fff", border: "none", borderRadius: 14, padding: "14px 20px", fontSize: "1rem", fontWeight: 700, cursor: "pointer", boxShadow: "0 10px 24px rgba(17,24,39,0.16)" } as const,
    secondary:      { background: "#fff", color: "#111827", border: "1px solid #d1d5db", borderRadius: 14, padding: "13px 18px", fontSize: "1rem", fontWeight: 600, cursor: "pointer" } as const,
    disabled:       { opacity: 0.45, cursor: "not-allowed" } as const,
    optionGrid:     { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 20 } as const,
    optionCard:     { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 18, padding: 18, cursor: "pointer", textAlign: "left" as const, transition: "all 0.2s ease" },
    selectedCard:   { border: "2px solid #2563eb", background: "#eff6ff", boxShadow: "0 0 0 2px rgba(37,99,235,0.1)" },
    selectedGreen:  { border: "2px solid #059669", background: "#ecfdf5", boxShadow: "0 0 0 2px rgba(5,150,105,0.1)" },
    optionTitle:    { fontWeight: 700, fontSize: "1.05rem", marginBottom: 8, color: "#111827" },
    optionMeta:     { color: "#6b7280", fontSize: "0.95rem", lineHeight: 1.45 },
    estimateBox:    { background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 16, padding: 16, textAlign: "center" as const, marginTop: 6 } as const,
    estimateLabel:  { color: "#6b7280", fontSize: "0.95rem", marginBottom: 6 },
    estimateValue:  { fontSize: "1.05rem", fontWeight: 800, color: "#111827", lineHeight: 1.5 },
    noteBox:        { marginTop: 14, background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 16, padding: 14, color: "#374151", textAlign: "center" as const, lineHeight: 1.45 } as const,
    addOnGrid:      { display: "grid", gap: 12, marginBottom: 18 } as const,
    addOnRow:       { display: "flex", alignItems: "center", gap: 14, padding: 16, borderRadius: 16, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", justifyContent: "space-between", flexWrap: "wrap" as const },
    checkWrap:      { display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 220 },
    checkbox:       { width: 18, height: 18, accentColor: "#111827" },
    addOnPrice:     { color: "#374151", fontWeight: 700 },
    inputGrid:      { display: "grid", gap: 14, maxWidth: 560, margin: "0 auto" } as const,
    input:          { width: "100%", boxSizing: "border-box" as const, background: "#fff", color: "#111827", border: "1px solid #d1d5db", borderRadius: 14, padding: "14px 16px", fontSize: "1rem", outline: "none" },
    buttonRow:      { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" as const, marginTop: 24 },
    rightButtons:   { display: "flex", gap: 12, marginLeft: "auto" } as const,
    summaryGrid:    { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginTop: 22 } as const,
    summaryCard:    { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 16 },
    sectionLabel:   { fontSize: "0.95rem", fontWeight: 700, color: "#374151", marginTop: 6, marginBottom: -4, textAlign: "left" as const },
    summaryHeading: { fontSize: "0.92rem", color: "#6b7280", marginBottom: 8, textTransform: "uppercase" as const, letterSpacing: "0.04em" },
    summaryValue:   { fontSize: "1rem", fontWeight: 700, lineHeight: 1.5, color: "#111827", wordBreak: "break-word" as const },
    successWrap:    { textAlign: "center" as const, padding: "10px 0" },
    successText:    { fontSize: "1.05rem", color: "#4b5563", lineHeight: 1.6, maxWidth: 620, margin: "0 auto 24px" },
  };

  const Header = () => (
    <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
      <div style={{ maxWidth: 760, width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
          <img src={logo} alt="ATX Prestige Detailing logo" style={{ width: 72, height: 72, objectFit: "contain" as const, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: "clamp(1.5rem, 5vw, 2.8rem)", fontWeight: 800, letterSpacing: "-1px", color: "#111827", margin: 0, lineHeight: 1.05 }}>ATX Prestige Detailing</h1>
            <p style={{ color: "#6b7280", fontSize: "clamp(0.8rem, 2.5vw, 1rem)", marginTop: 6, marginBottom: 0, lineHeight: 1.4, fontStyle: "italic" }}>Defined by Detail, Driven by Standards, Trusted for Prestige</p>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
          {googleUser ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img src={googleUser.picture} alt={googleUser.name} style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid #e5e7eb", flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#111827" }}>{googleUser.name}</div>
                <div style={{ fontSize: "0.72rem", color: "#6b7280" }}>{googleUser.email}</div>
              </div>
              <button onClick={handleSignOut} style={{ fontSize: "0.8rem", color: "#6b7280", background: "none", border: "1px solid #d1d5db", borderRadius: 8, padding: "4px 10px", cursor: "pointer", marginLeft: 4 }}>Sign out</button>
            </div>
          ) : (
            <div id="google-signin-btn" />
          )}
        </div>
      </div>
    </div>
  );

  const ProgressBar = () => (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", color: "#6b7280", fontSize: "0.9rem", marginBottom: 8 }}>
        <span>Booking</span>
        <span>Step {step} of {TOTAL_STEPS - 1}</span>
      </div>
      <div style={{ height: 8, background: "#e5e7eb", borderRadius: 999, overflow: "hidden", border: "1px solid #d1d5db" }}>
        <div style={{ height: "100%", width: `${(step / (TOTAL_STEPS - 1)) * 100}%`, background: "linear-gradient(90deg,#6b7280,#9ca3af)", borderRadius: 999, transition: "width 0.25s ease" }} />
      </div>
    </div>
  );

  // MY BOOKINGS VIEW
  if (view === "myBookings") {
    return (
      <div style={S.page}>
        <div style={S.container}>
          <Header />
          <div style={S.card}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, flexWrap: "wrap" as const }}>
              <button onClick={() => setView("booking")} style={{ ...S.secondary, padding: "9px 14px", fontSize: "0.9rem" }}>Back</button>
              <h2 style={{ ...S.title, margin: 0, fontSize: "1.8rem" }}>My Bookings</h2>
              <button onClick={() => { setView("booking"); setStep(1); }} style={{ ...S.primary, marginLeft: "auto", padding: "10px 16px", fontSize: "0.9rem" }}>Book New Service</button>
            </div>

            <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "2px solid #e5e7eb" }}>
              <button onClick={() => setBookingsTab("appointments")} style={{ background: "none", border: "none", cursor: "pointer", padding: "10px 18px", fontSize: "0.95rem", fontWeight: 700, color: bookingsTab === "appointments" ? "#111827" : "#9ca3af", borderBottom: bookingsTab === "appointments" ? "3px solid #111827" : "3px solid transparent", marginBottom: -2 }}>
                My Appointments
              </button>
              {isMaintenance && (
                <button onClick={() => setBookingsTab("maintenance")} style={{ background: "none", border: "none", cursor: "pointer", padding: "10px 18px", fontSize: "0.95rem", fontWeight: 700, color: bookingsTab === "maintenance" ? "#059669" : "#9ca3af", borderBottom: bookingsTab === "maintenance" ? "3px solid #059669" : "3px solid transparent", marginBottom: -2 }}>
                  Maintenance Plan
                </button>
              )}
            </div>

            {bookingsLoading ? (
              <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>Loading your bookings...</div>
            ) : (
              <>
                {bookingsTab === "appointments" && (
                  <>
                    {upcomingStandard.length === 0 && pastStandard.length === 0 && (
                      <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>
                        No bookings found for {googleUser?.email}.<br />
                        <button onClick={() => { setView("booking"); setStep(1); }} style={{ ...S.primary, marginTop: 16, display: "inline-block" }}>Book Your First Service</button>
                      </div>
                    )}
                    {upcomingStandard.length > 0 && (
                      <>
                        <div style={{ fontWeight: 700, color: "#374151", fontSize: "0.95rem", marginBottom: 12, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>Upcoming</div>
                        <div style={{ display: "grid", gap: 14, marginBottom: 28 }}>
                          {upcomingStandard.map((b, i) => (
                            <BookingCard key={i} booking={b} upcoming onRequestChange={(b) => { setChangeTarget(b); setChangeNote(""); setChangeSubmitted(false); setView("requestChange"); }} />
                          ))}
                        </div>
                      </>
                    )}
                    {pastStandard.length > 0 && (
                      <>
                        <div style={{ fontWeight: 700, color: "#9ca3af", fontSize: "0.95rem", marginBottom: 12, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>Past Services</div>
                        <div style={{ display: "grid", gap: 14 }}>
                          {pastStandard.map((b, i) => <BookingCard key={i} booking={b} upcoming={false} onRequestChange={() => {}} />)}
                        </div>
                      </>
                    )}
                  </>
                )}

                {bookingsTab === "maintenance" && isMaintenance && (
                  <>
                    <div style={{ background: "#ecfdf5", border: "1px solid #6ee7b7", borderRadius: 14, padding: "14px 18px", marginBottom: 24 }}>
                      <div style={{ fontWeight: 700, color: "#065f46", marginBottom: 4 }}>Maintenance Client</div>
                      <div style={{ color: "#047857", fontSize: "0.92rem", lineHeight: 1.6 }}>
                        Your maintenance schedule is managed by ATX Prestige Detailing. Use "Request a Change" on any upcoming service to reschedule or adjust. You can also book additional one-time services for family or extra vehicles through the normal booking flow.
                      </div>
                    </div>
                    {upcomingMaintenance.length > 0 && (
                      <>
                        <div style={{ fontWeight: 700, color: "#374151", fontSize: "0.95rem", marginBottom: 12, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>Upcoming</div>
                        <div style={{ display: "grid", gap: 14, marginBottom: 28 }}>
                          {upcomingMaintenance.map((b, i) => (
                            <MaintenanceCard key={i} booking={b} onRequestChange={(b) => { setChangeTarget(b); setChangeNote(""); setChangeSubmitted(false); setView("requestChange"); }} />
                          ))}
                        </div>
                      </>
                    )}
                    {pastMaintenance.length > 0 && (
                      <>
                        <div style={{ fontWeight: 700, color: "#9ca3af", fontSize: "0.95rem", marginBottom: 12, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>Past Services</div>
                        <div style={{ display: "grid", gap: 14 }}>
                          {pastMaintenance.map((b, i) => <MaintenanceCard key={i} booking={b} onRequestChange={() => {}} />)}
                        </div>
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // REQUEST A CHANGE VIEW
  if (view === "requestChange" && changeTarget) {
    const vl = changeTarget.vehicle === "boat"
      ? [changeTarget.boatSize, changeTarget.make, changeTarget.model].filter(Boolean).join(" ")
      : [changeTarget.year, changeTarget.make, changeTarget.model].filter(Boolean).join(" ");

    return (
      <div style={S.page}>
        <div style={S.container}>
          <Header />
          <div style={S.card}>
            <button onClick={() => setView("myBookings")} style={{ ...S.secondary, padding: "9px 14px", fontSize: "0.9rem", marginBottom: 20 }}>Back to My Bookings</button>
            {changeSubmitted ? (
              <div style={S.successWrap}>
                <h2 style={S.title}>Request Sent</h2>
                <p style={S.successText}>Your request has been sent. Someone will reach out to confirm the changes.</p>
                <button onClick={() => { setView("myBookings"); loadMyBookings(); }} style={S.primary}>Back to My Bookings</button>
              </div>
            ) : (
              <>
                <h2 style={S.title}>Request a Change</h2>
                <p style={S.subtitle}>Let us know what you'd like to change about this appointment.</p>
                <div style={{ ...S.summaryCard, marginBottom: 24, background: "#f9fafb" }}>
                  <div style={S.summaryHeading}>Appointment</div>
                  <div style={S.summaryValue}>
                    {formatDateLabel(changeTarget.date)}{changeTarget.time ? ` at ${changeTarget.time}` : ""}<br />
                    {vl}<br />
                    {changeTarget.packageType === "basic" ? "Basic Detail" : changeTarget.packageType === "premium" ? "Premium Detail" : changeTarget.packageType}
                  </div>
                </div>
                <div style={{ maxWidth: 560, margin: "0 auto" }}>
                  <div style={S.sectionLabel}>What would you like to change?</div>
                  <textarea
                    style={{ ...S.input, marginTop: 10, minHeight: 130, resize: "vertical" as const, fontFamily: "inherit", lineHeight: 1.5 }}
                    placeholder="Describe what you'd like to change, such as a different date, time, or service update."
                    value={changeNote} onChange={(e) => setChangeNote(e.target.value)}
                  />
                </div>
                <div style={{ ...S.buttonRow, maxWidth: 560, margin: "20px auto 0" }}>
                  <button style={S.secondary} onClick={() => setView("myBookings")}>Cancel</button>
                  <button style={{ ...S.primary, ...(!changeNote.trim() || changeSubmitting ? S.disabled : {}) }}
                    onClick={submitChangeRequest} disabled={!changeNote.trim() || changeSubmitting}>
                    {changeSubmitting ? "Sending..." : "Send Request"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // BOOKING FLOW
  return (
    <div style={S.page}>
      <div style={S.container}>
        <Header />
        {step > 0 && step < TOTAL_STEPS - 1 && <ProgressBar />}
        <div style={S.card}>

          {/* STEP 0 */}
          {step === 0 && (
            <>
              <h2 style={S.title}>Book a Detail Service</h2>
              <p style={S.subtitle}>Auto and marine detailing in Austin, TX.</p>
              <div style={{ display: "flex", justifyContent: "center", gap: 12, padding: "10px 0 2px", flexWrap: "wrap" as const }}>
                <button style={S.primary} onClick={() => setStep(1)}>Book a Service</button>
                {googleUser && (
                  <button style={S.secondary} onClick={openMyBookings}>My Bookings</button>
                )}
              </div>
              {!googleUser && (
                <p style={{ textAlign: "center", color: "#9ca3af", fontSize: "0.88rem", marginTop: 18 }}>
                  Sign in with Google to view your past and upcoming appointments.
                </p>
              )}
            </>
          )}

          {/* STEP 1 */}
          {step === 1 && (
            <>
              <h2 style={S.title}>Vehicle Type</h2>
              <p style={S.subtitle}>Select the vehicle you're booking for.</p>
              <div style={S.optionGrid}>
                {vehicleOptions.map((option) => (
                  <button key={option.id}
                    style={{ ...S.optionCard, ...(vehicle === option.id ? S.selectedCard : {}) }}
                    onClick={() => { setVehicle(option.id); setPkg(""); setMake(""); setModel(""); setMakeOptions([]); setModelOptions([]); setBoatMake(""); setBoatModel(""); setBoatSize(""); setAddOns([]); }}
                  >
                    <div style={S.optionTitle}>{option.label}</div>
                    <div style={S.optionMeta}>Basic {formatCurrency(option.basicRate)}/hr<br />Premium {formatCurrency(option.premiumRate)}/hr</div>
                  </button>
                ))}
              </div>
              <div style={S.buttonRow}>
                <button style={S.secondary} onClick={() => setStep(0)}>Back</button>
                <div style={S.rightButtons}>
                  <button style={{ ...S.primary, ...(!vehicle ? S.disabled : {}) }} onClick={next} disabled={!vehicle}>Next</button>
                </div>
              </div>
            </>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <>
              <h2 style={S.title}>Service Plan</h2>
              <p style={S.subtitle}>Is this a one-time detail or a recurring maintenance plan?</p>
              <div style={S.optionGrid}>
                <button
                  style={{ ...S.optionCard, ...(clientType === "oneTime" ? S.selectedCard : {}) }}
                  onClick={() => { setClientType("oneTime"); setFrequency(""); }}
                >
                  <div style={S.optionTitle}>One-Time Service</div>
                  <div style={S.optionMeta}>A single detail appointment. Great for a deep clean, special occasion, or a first visit.</div>
                </button>
                <button
                  style={{ ...S.optionCard, ...(clientType === "maintenance" ? S.selectedGreen : {}) }}
                  onClick={() => setClientType("maintenance")}
                >
                  <div style={{ ...S.optionTitle, color: clientType === "maintenance" ? "#065f46" : "#111827" }}>Maintenance Plan</div>
                  <div style={S.optionMeta}>Recurring details to keep your vehicle in top condition. Choose bi-weekly or monthly.</div>
                </button>
              </div>

              {clientType === "maintenance" && (
                <div style={{ marginTop: 4, marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, color: "#374151", fontSize: "0.95rem", marginBottom: 12, textAlign: "center" as const }}>
                    How often would you like service?
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <button
                      style={{ ...S.optionCard, ...(frequency === "biweekly" ? S.selectedGreen : {}), textAlign: "center" as const }}
                      onClick={() => setFrequency("biweekly")}
                    >
                      <div style={{ ...S.optionTitle, textAlign: "center" as const, color: frequency === "biweekly" ? "#065f46" : "#111827" }}>Bi-Weekly</div>
                      <div style={S.optionMeta}>Every two weeks. Good for high-use vehicles or boats.</div>
                    </button>
                    <button
                      style={{ ...S.optionCard, ...(frequency === "monthly" ? S.selectedGreen : {}), textAlign: "center" as const }}
                      onClick={() => setFrequency("monthly")}
                    >
                      <div style={{ ...S.optionTitle, textAlign: "center" as const, color: frequency === "monthly" ? "#065f46" : "#111827" }}>Monthly</div>
                      <div style={S.optionMeta}>Once a month. A good balance of upkeep and convenience.</div>
                    </button>
                  </div>
                </div>
              )}

              <div style={S.buttonRow}>
                <button style={S.secondary} onClick={back}>Back</button>
                <div style={S.rightButtons}>
                  <button
                    style={{ ...S.primary, ...(!clientType || (clientType === "maintenance" && !frequency) ? S.disabled : {}) }}
                    onClick={next}
                    disabled={!clientType || (clientType === "maintenance" && !frequency)}
                  >Next</button>
                </div>
              </div>
            </>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <>
              <h2 style={S.title}>Detail Package</h2>
              <p style={S.subtitle}>Choose the level of service for this appointment.</p>
              <div style={S.optionGrid}>
                {(["basic", "premium"] as PackageType[]).map((packageType) => {
                  const label = packageType === "basic" ? "Basic Detail" : "Premium Detail";
                  const rateText = selectedVehicle
                    ? `${formatCurrency(packageType === "basic" ? selectedVehicle.basicRate : selectedVehicle.premiumRate)}/hr`
                    : "Select vehicle first";
                  const timeText = !vehicle ? "Time shown after vehicle selection"
                    : vehicle === "boat" ? (packageType === "premium" ? "5-8 hours avg" : "3-6 hours avg")
                    : packageType === "premium" ? "3-5 hours avg"
                    : vehicle === "truckSuv" ? "3-5 hours avg" : "3-4 hours avg";
                  return (
                    <button key={packageType} style={{ ...S.optionCard, ...(pkg === packageType ? S.selectedCard : {}) }} onClick={() => setPkg(packageType)}>
                      <div style={S.optionTitle}>{label}</div>
                      <div style={S.optionMeta}>{rateText}<br />{timeText}</div>
                    </button>
                  );
                })}
              </div>
              <div style={{ marginTop: 8, fontSize: "0.9rem", color: "#6b7280" }}>
                Time estimates are based on average conditions and may vary at the time of service.
              </div>
              <div style={S.estimateBox}><div style={S.estimateLabel}>Estimate</div><div style={S.estimateValue}>{estimateText || "$ per hour"}</div></div>
              <div style={S.noteBox}>
                To see what's included in each package, visit{" "}
                <a href="https://ATXPrestigeDetailing.com" target="_blank" rel="noopener noreferrer" style={{ color: "#111827", textDecoration: "none", fontWeight: 600, borderBottom: "1px solid #d1d5db" }}>ATXPrestigeDetailing.com</a>
              </div>
              <div style={S.buttonRow}>
                <button style={S.secondary} onClick={back}>Back</button>
                <div style={S.rightButtons}><button style={{ ...S.primary, ...(!pkg ? S.disabled : {}) }} onClick={next} disabled={!pkg}>Next</button></div>
              </div>
            </>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <>
              <h2 style={S.title}>Add-On Services</h2>
              <p style={S.subtitle}>{vehicle === "boat" ? "Optional marine services for this appointment." : "Optional services to add to your appointment."}</p>
              <div style={S.addOnGrid}>
                {(vehicle === "boat" ? marineAddOnOptions : addOnOptions).map((option) => (
                  <label key={option.label} style={S.addOnRow}>
                    <div style={S.checkWrap}>
                      <input style={S.checkbox} type="checkbox" checked={addOns.includes(option.label)} onChange={() => toggleAddOn(option.label)} />
                      <span>{option.label}</span>
                    </div>
                    <span style={S.addOnPrice}>{option.priceText}</span>
                  </label>
                ))}
              </div>
              <div style={S.estimateBox}>
                <div style={S.estimateLabel}>Estimate</div>
                <div style={S.estimateValue}>{estimateText || "$ per hour"}{addOnSummaryText ? ` + ${addOnSummaryText}` : ""}</div>
              </div>
              <div style={S.buttonRow}>
                <button style={S.secondary} onClick={back}>Back</button>
                <div style={S.rightButtons}><button style={S.primary} onClick={next}>Next</button></div>
              </div>
            </>
          )}

          {/* STEP 5 */}
          {step === 5 && (
            <>
              <h2 style={S.title}>Service Location</h2>
              <p style={S.subtitle}>Choose how you'd like the service to be done.</p>
              <div style={S.optionGrid}>
                <button style={{ ...S.optionCard, ...(serviceType === "mobile" ? S.selectedCard : {}) }} onClick={() => { setServiceType("mobile"); setAddressSelected(false); }}>
                  <div style={S.optionTitle}>Mobile Service</div>
                  <div style={S.optionMeta}>We come to you. Enter your location below after selecting this option.</div>
                </button>
                <button style={{ ...S.optionCard, ...(serviceType === "dropoff" ? S.selectedCard : {}) }}
                  onClick={() => { setServiceType("dropoff"); setAddress(""); setStreet(""); setCity(""); setStateRegion(""); setZip(""); setPlaceId(""); setLat(""); setLng(""); setAddressSelected(false); }}>
                  <div style={S.optionTitle}>Drop-Off Service</div>
                  <div style={S.optionMeta}>Drop off your vehicle with us. We'll follow up with location details.</div>
                </button>
              </div>
              {serviceType === "mobile" && (
                <div style={{ marginTop: 18 }}>
                  <input ref={addressInputRef} type="text" value={address}
                    onChange={(e) => { setAddress(e.target.value); setAddressSelected(false); }}
                    placeholder="Start typing your address" style={S.input} />
                </div>
              )}
              <div style={S.buttonRow}>
                <button style={S.secondary} onClick={back}>Back</button>
                <div style={S.rightButtons}>
                  <button style={{ ...S.primary, ...(!serviceType || (serviceType === "mobile" && !address.trim()) ? S.disabled : {}) }}
                    onClick={next} disabled={!serviceType || (serviceType === "mobile" && !address.trim())}>Next</button>
                </div>
              </div>
            </>
          )}

          {/* STEP 6 */}
          {step === 6 && (
            <>
              <h2 style={S.title}>Your Information</h2>
              <p style={S.subtitle}>We'll use this to confirm your appointment.</p>
              <div style={S.inputGrid}>
                <div style={{ marginTop: 20 }}>
                  <div style={S.sectionLabel}>Appointment Date</div>
                  <select style={{ ...S.input, backgroundColor: "#fff", color: "#111827", cursor: "pointer" }} value={selectedDate}
                    onChange={(e) => { setSelectedDate(e.target.value); setSelectedTime(""); }}>
                    <option value="">Select a date</option>
                    {availableDates.map((date, i) => <option key={i} value={date}>{formatDateLabel(date)}</option>)}
                  </select>
                </div>
                <div style={{ marginTop: 20 }}>
                  <div style={S.sectionLabel}>Appointment Time</div>
                  <select style={{ ...S.input, backgroundColor: "#fff", color: "#111827", cursor: "pointer" }} value={selectedTime} onChange={(e) => setSelectedTime(e.target.value)}>
                    <option value="">Select a time</option>
                    {availableSlots.map((slot, i) => <option key={i} value={slot.time}>{slot.time}</option>)}
                  </select>
                  {selectedDate && availableSlots.length === 0 && (
                    <div style={{ marginTop: 8, color: "#b91c1c", fontSize: "0.95rem" }}>No available times for this date.</div>
                  )}
                </div>
                <input style={S.input} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
                <input style={S.input} placeholder="Phone number" value={phone} type="tel" inputMode="numeric"
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "").slice(0, 10);
                    const fmt = raw.length > 6 ? `(${raw.slice(0,3)}) ${raw.slice(3,6)}-${raw.slice(6)}` : raw.length > 3 ? `(${raw.slice(0,3)}) ${raw.slice(3)}` : raw;
                    setPhone(fmt);
                  }} />
                <input style={S.input} placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>

              <div style={{ marginTop: 24 }}>
                <div style={S.sectionLabel}>{vehicle === "boat" ? "Boat Details" : "Vehicle Details"}</div>
                {vehicle === "boat" ? (
                  <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" as const }}>
                    <input style={{ ...S.input, flex: 1, minWidth: 120 }} placeholder="Size (e.g. 24 ft)" value={boatSize} onChange={(e) => setBoatSize(e.target.value)} />
                    <input style={{ ...S.input, flex: 2, minWidth: 180 }} placeholder="Make (e.g. Sea Ray)" value={boatMake} onChange={(e) => setBoatMake(e.target.value)} />
                    <input style={{ ...S.input, flex: 2, minWidth: 180 }} placeholder="Model (e.g. Sundancer 320)" value={boatModel} onChange={(e) => setBoatModel(e.target.value)} />
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" as const }}>
                    <select style={{ ...S.input, flex: 1, minWidth: 120, backgroundColor: "#fff", color: "#111827" }} value={year} onChange={(e) => { setYear(e.target.value); setModel(""); setModelOptions([]); }}>
                      <option value="">Year</option>
                      {yearOptions.map((yr) => <option key={yr} value={yr}>{yr}</option>)}
                    </select>
                    <select style={{ ...S.input, flex: 2, minWidth: 180, backgroundColor: "#fff", color: "#111827" }} value={make} onChange={(e) => { setMake(e.target.value); setModel(""); setModelOptions([]); }} disabled={loadingMakes}>
                      <option value="">{loadingMakes ? "Loading..." : "Make"}</option>
                      {makeOptions.map((mk) => <option key={mk} value={mk}>{mk}</option>)}
                    </select>
                    <select style={{ ...S.input, flex: 2, minWidth: 180, backgroundColor: "#fff", color: "#111827" }} value={model} onChange={(e) => setModel(e.target.value)} disabled={!year || !make || loadingModels}>
                      <option value="">{!year || !make ? "Select year and make first" : loadingModels ? "Loading..." : "Model"}</option>
                      {modelOptions.map((mdl) => <option key={mdl} value={mdl}>{mdl}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div style={S.buttonRow}>
                <button style={S.secondary} onClick={back}>Back</button>
                <div style={S.rightButtons}>
                  <button style={{ ...S.primary, ...(step6Disabled ? S.disabled : {}) }} onClick={next} disabled={step6Disabled}>Review Booking</button>
                </div>
              </div>
            </>
          )}

          {/* STEP 7 */}
          {step === 7 && (
            <>
              <h2 style={S.title}>Review Your Booking</h2>
              <p style={S.subtitle}>Check everything over before submitting.</p>
              <div style={S.summaryGrid}>
                <div style={S.summaryCard}><div style={S.summaryHeading}>Customer</div><div style={S.summaryValue}>{name}<br />{phone}<br />{email}</div></div>
                <div style={S.summaryCard}><div style={S.summaryHeading}>Appointment</div><div style={S.summaryValue}>{formatDateLabel(selectedDate)}<br />{selectedTime || "N/A"}</div></div>
                <div style={S.summaryCard}>
                  <div style={S.summaryHeading}>Service Plan</div>
                  <div style={S.summaryValue}>
                    {clientType === "oneTime" ? "One-Time Service" : clientType === "maintenance" ? "Maintenance Plan" : "N/A"}
                    {clientType === "maintenance" && frequency && <><br />{frequency === "biweekly" ? "Bi-Weekly" : "Monthly"}</>}
                  </div>
                </div>
                <div style={S.summaryCard}><div style={S.summaryHeading}>Package</div><div style={S.summaryValue}>{selectedVehicle?.label || "N/A"}<br />{pkg === "basic" ? "Basic Detail" : pkg === "premium" ? "Premium Detail" : "N/A"}<br />{estimateText || "N/A"}</div></div>
                <div style={S.summaryCard}><div style={S.summaryHeading}>Location</div><div style={S.summaryValue}>{serviceType === "mobile" ? "Mobile Service" : serviceType === "dropoff" ? "Drop-Off Service" : "N/A"}{serviceType === "mobile" && address && <><br />{address}</>}</div></div>
                <div style={S.summaryCard}><div style={S.summaryHeading}>{vehicle === "boat" ? "Boat" : "Vehicle"}</div><div style={S.summaryValue}>{vehicleSummary}<br />{selectedVehicle?.label || "N/A"}</div></div>
                <div style={S.summaryCard}><div style={S.summaryHeading}>Add-Ons</div><div style={S.summaryValue}>{addOns.length ? addOns.join(", ") : "None"}</div></div>
                <div style={S.summaryCard}><div style={S.summaryHeading}>Add-On Estimate</div><div style={S.summaryValue}>{formatCurrency(addOnEstimate)}</div></div>
                <div style={S.summaryCard}><div style={S.summaryHeading}>Avg Time</div><div style={S.summaryValue}>{packageHours}</div></div>
              </div>

              <div style={{ marginTop: 24 }}>
                <div style={S.sectionLabel}>Additional Notes</div>
                <textarea style={{ ...S.input, marginTop: 10, minHeight: 100, resize: "vertical" as const, fontFamily: "inherit", lineHeight: 1.5 }}
                  placeholder="Any access instructions, special requests, or notes about the vehicle condition."
                  value={bookingNotes} onChange={(e) => setBookingNotes(e.target.value)} />
              </div>

              <div style={S.buttonRow}>
                <button style={S.secondary} onClick={back}>Back</button>
                <div style={S.rightButtons}>
                  <button style={S.primary} onClick={async () => {
                    try {
                      if (serviceType === "mobile") {
                        if (!address.trim()) { alert("Please enter your service address."); return; }
                        if (!addressSelected) { alert("Please select a valid address from the dropdown."); return; }
                      }
                      const [yp, mp, dp] = selectedDate.split("-");
                      const safeDate = `${mp}/${dp}/${yp}`;
                      const res = await fetch(SCRIPT_URL, {
                        method: "POST",
                        body: JSON.stringify({
                          action: "bookAppointment", name, phone, email,
                          date: selectedDate, displayDate: safeDate, time: selectedTime,
                          year: vehicle === "boat" ? "" : year,
                          make: vehicle === "boat" ? boatMake : make,
                          model: vehicle === "boat" ? boatModel : model,
                          boatSize: vehicle === "boat" ? boatSize : "",
                          vehicle, packageType: pkg, hourlyRate,
                          addOns: addOns.join(", "), addOnEstimate,
                          serviceType, address, street, city,
                          state: stateRegion, zip, placeId, lat, lng,
                          avgTime: packageHours, notes: bookingNotes,
                          clientType,
                          recurringFrequency: frequency,
                        }),
                      });
                      const data = await res.json();
                      if (data.success) { next(); }
                      else { alert("Something went wrong. Please try again."); console.error(data); }
                    } catch (err) { alert("Something went wrong. Please try again."); console.error(err); }
                  }}>Submit Booking</button>
                </div>
              </div>
            </>
          )}

          {/* STEP 8 */}
          {step === 8 && (
            <>
              <div style={S.successWrap}>
                <h2 style={S.title}>Booking Submitted</h2>
                <p style={S.successText}>
                  Your booking request has been received. Someone will be in touch shortly to confirm your appointment.
                  {clientType === "maintenance" && ` We'll also follow up to get your ${frequency === "biweekly" ? "bi-weekly" : "monthly"} schedule set up.`}
                </p>
                {googleUser && (
                  <button onClick={openMyBookings} style={{ ...S.secondary, marginTop: 8 }}>View My Bookings</button>
                )}
              </div>
              <div style={S.summaryGrid}>
                <div style={S.summaryCard}><div style={S.summaryHeading}>Customer</div><div style={S.summaryValue}>{name}<br />{phone}<br />{email}</div></div>
                <div style={S.summaryCard}><div style={S.summaryHeading}>Appointment</div><div style={S.summaryValue}>{formatDateLabel(selectedDate)}<br />{selectedTime || "N/A"}</div></div>
                <div style={S.summaryCard}>
                  <div style={S.summaryHeading}>Service Plan</div>
                  <div style={S.summaryValue}>
                    {clientType === "oneTime" ? "One-Time Service" : "Maintenance Plan"}
                    {clientType === "maintenance" && frequency && <><br />{frequency === "biweekly" ? "Bi-Weekly" : "Monthly"}</>}
                  </div>
                </div>
                <div style={S.summaryCard}><div style={S.summaryHeading}>Package</div><div style={S.summaryValue}>{selectedVehicle?.label || "N/A"}<br />{pkg === "basic" ? "Basic Detail" : pkg === "premium" ? "Premium Detail" : "N/A"}<br />{estimateText || "N/A"}</div></div>
                <div style={S.summaryCard}><div style={S.summaryHeading}>Location</div><div style={S.summaryValue}>{serviceType === "mobile" ? "Mobile Service" : serviceType === "dropoff" ? "Drop-Off Service" : "N/A"}<br />{address || "No address provided"}</div></div>
                <div style={S.summaryCard}><div style={S.summaryHeading}>{vehicle === "boat" ? "Boat" : "Vehicle"}</div><div style={S.summaryValue}>{vehicleSummary}<br />{selectedVehicle?.label || "N/A"}</div></div>
                <div style={S.summaryCard}><div style={S.summaryHeading}>Add-Ons</div><div style={S.summaryValue}>{addOns.length ? addOns.join(", ") : "None"}</div></div>
                <div style={S.summaryCard}><div style={S.summaryHeading}>Add-On Estimate</div><div style={S.summaryValue}>{formatCurrency(addOnEstimate)}</div></div>
                <div style={S.summaryCard}><div style={S.summaryHeading}>Avg Time</div><div style={S.summaryValue}>{packageHours}</div></div>
                {bookingNotes.trim() && (
                  <div style={{ ...S.summaryCard, gridColumn: "1 / -1" }}>
                    <div style={S.summaryHeading}>Notes</div>
                    <div style={{ ...S.summaryValue, fontWeight: 400, color: "#374151", whiteSpace: "pre-wrap" as const }}>{bookingNotes}</div>
                  </div>
                )}
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}