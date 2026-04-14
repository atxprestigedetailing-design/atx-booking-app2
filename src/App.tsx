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
  "https://script.google.com/macros/s/AKfycbxQmSgSgtijhKGg7jm7g1rGntUn1rq7wLi9YDepNOKNVPtW8zhc6G4K1z7CDvmLGt16JA/exec";

const TOTAL_STEPS = 9;
const ADMIN_EMAIL = "atxprestigedetailing@gmail.com";
const VENMO_URL = "https://venmo.com/u/emilio512";
const CASHAPP_URL = "https://cash.app/$Emiliofive12";

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
  invoiceAmount: string;
  invoiceStatus: string;
  invoiceNote: string;
  name: string;
  phone: string;
  email: string;
  rowIndex: number;
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

// Calculate recurring schedule dates from a start date
function calcRecurringDates(startDateStr: string, freq: string, count: number = 6): string[] {
  if (!startDateStr || !freq) return [];
  const [y, m, d] = startDateStr.split("-").map(Number);
  const start = new Date(y, m - 1, d);
  const dates: string[] = [];

  if (freq === "biweekly") {
    let next = new Date(start);
    next.setDate(next.getDate() + 14);
    while (dates.length < count) {
      dates.push(formatDateLabel(fmtDate(next)));
      next.setDate(next.getDate() + 14);
    }
  } else if (freq === "monthly") {
    // Same weekday + same week position each month
    const dow = start.getDay();
    const weekPos = Math.ceil(start.getDate() / 7);
    const isLast = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7).getMonth() !== start.getMonth();

    let checkMonth = start.getMonth() + 1;
    let checkYear = start.getFullYear();
    if (checkMonth > 11) { checkMonth = 0; checkYear++; }

    while (dates.length < count) {
      const candidate = getNthWeekday(checkYear, checkMonth, dow, weekPos, isLast);
      if (candidate) dates.push(formatDateLabel(fmtDate(candidate)));
      checkMonth++;
      if (checkMonth > 11) { checkMonth = 0; checkYear++; }
      if (checkYear > start.getFullYear() + 3) break;
    }
  }
  return dates;
}

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getNthWeekday(year: number, month: number, dow: number, n: number, isLast: boolean): Date | null {
  if (isLast) {
    const last = new Date(year, month + 1, 0);
    while (last.getDay() !== dow) last.setDate(last.getDate() - 1);
    return last;
  }
  const first = new Date(year, month, 1);
  const diff = (dow - first.getDay() + 7) % 7;
  const result = new Date(year, month, 1 + diff + (n - 1) * 7);
  return result.getMonth() === month ? result : null;
}

function getCadenceLabel(startDateStr: string, freq: string): string {
  if (!startDateStr || !freq) return "";
  const [y, m, d] = startDateStr.split("-").map(Number);
  const start = new Date(y, m - 1, d);
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayName = dayNames[start.getDay()];
  if (freq === "biweekly") return `Every other ${dayName}`;
  const weekPos = Math.ceil(start.getDate() / 7);
  const isLast = new Date(y, m - 1, d + 7).getMonth() !== start.getMonth();
  const ordinals = ["", "1st", "2nd", "3rd", "4th", "5th"];
  const pos = isLast ? "last" : ordinals[weekPos];
  return `Every ${pos} ${dayName} of the month`;
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

async function fetchAllBookings(): Promise<Booking[]> {
  const res = await fetch(`${SCRIPT_URL}?action=getAllBookings`);
  const data: { bookings: Booking[] } = await res.json();
  return data.bookings || [];
}

async function updateBooking(rowIndex: number, updates: Record<string, string>): Promise<boolean> {
  const res = await fetch(SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify({ action: "updateBooking", rowIndex, ...updates }),
  });
  const data = await res.json();
  return data.success;
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
      {booking.invoiceStatus === "released" && booking.invoiceAmount && (
        <div style={{ marginTop: 10, background: "#fef9c3", border: "1px solid #fde047", borderRadius: 10, padding: "10px 14px", fontSize: "0.88rem", color: "#713f12" }}>
          <span style={{ fontWeight: 700 }}>Balance due: ${booking.invoiceAmount}</span>
          {booking.invoiceNote ? ` — ${booking.invoiceNote}` : ""}
        </div>
      )}
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 2 }}>
        <div style={{ fontSize: "1rem", fontWeight: 700, color: "#111827", flex: 1, minWidth: 0 }}>
          {formatDateLabel(booking.date)}{booking.time ? ` at ${booking.time}` : ""}
        </div>
        <span style={{ background: "#ecfdf5", color: "#059669", fontSize: "0.72rem", fontWeight: 700, borderRadius: 999, padding: "3px 9px", whiteSpace: "nowrap" as const, flexShrink: 0 }}>
          {freqLabel.toUpperCase()}
        </span>
      </div>
      {booking.recurringFrequency && booking.date && (
        <div style={{ fontSize: "0.82rem", color: "#059669", marginBottom: 6 }}>
          {getCadenceLabel(booking.date, booking.recurringFrequency)}
        </div>
      )}
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
  const [view, setView]                                 = useState<"booking" | "myBookings" | "requestChange" | "admin" | "balance">("booking");
  const [adminTab, setAdminTab]                         = useState<"bookings" | "invoices">("bookings");
  const [adminBookings, setAdminBookings]               = useState<Booking[]>([]);
  const [adminLoading, setAdminLoading]                 = useState(false);
  const [adminFilter, setAdminFilter]                   = useState<"all" | "upcoming" | "past" | "maintenance">("all");
  const [selectedAdminBooking, setSelectedAdminBooking] = useState<Booking | null>(null);
  const [completeAmount, setCompleteAmount]             = useState("");
  const [completeNote, setCompleteNote]                 = useState("");
  const [completeLoading, setCompleteLoading]           = useState(false);
  const [squarePopup, setSquarePopup]                   = useState(false);
  const [squareBooking, setSquareBooking]               = useState<Booking | null>(null);
  const [editingBooking, setEditingBooking]             = useState<Booking | null>(null);
  const [editFields, setEditFields]                     = useState<Partial<Booking>>({});
  const [editSaving, setEditSaving]                     = useState(false);
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
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredential,
    });
  }, [googleScriptLoaded, googleUser]);

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

  const loadAdminBookings = useCallback(async () => {
    setAdminLoading(true);
    try {
      const bookings = await fetchAllBookings();
      setAdminBookings(bookings);
    } catch (e) { console.error("Failed to load admin bookings", e); }
    finally { setAdminLoading(false); }
  }, []);

  async function handleMarkComplete() {
    if (!selectedAdminBooking || !completeAmount) return;
    setCompleteLoading(true);
    try {
      const ok = await updateBooking(selectedAdminBooking.rowIndex, {
        status: "Completed",
        invoiceAmount: completeAmount,
        invoiceStatus: "pending",
        invoiceNote: completeNote,
      });
      if (ok) {
        // Auto-create next booking row for maintenance clients
        if (selectedAdminBooking.clientType === "maintenance" && selectedAdminBooking.recurringFrequency && selectedAdminBooking.date) {
          const nextDates = calcRecurringDates(selectedAdminBooking.date, selectedAdminBooking.recurringFrequency, 1);
          if (nextDates.length > 0) {
            // nextDates returns formatted labels — we need YYYY-MM-DD
            // Use fmtDate on the calculated date
            const [y, m, d] = selectedAdminBooking.date.split("-").map(Number);
            const start = new Date(y, m - 1, d);
            const nextDate = selectedAdminBooking.recurringFrequency === "biweekly"
              ? new Date(start.getFullYear(), start.getMonth(), start.getDate() + 14)
              : getNthWeekday(
                  start.getMonth() + 1 > 11 ? start.getFullYear() + 1 : start.getFullYear(),
                  start.getMonth() + 1 > 11 ? 0 : start.getMonth() + 1,
                  start.getDay(),
                  Math.ceil(start.getDate() / 7),
                  new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7).getMonth() !== start.getMonth()
                );
            if (nextDate) {
              const nextDateStr = fmtDate(nextDate);
              // Check not already booked
              // will be checked server-side
              try {
                await fetch(SCRIPT_URL, {
                  method: "POST",
                  body: JSON.stringify({
                    action: "createNextMaintenanceBooking",
                    ...selectedAdminBooking,
                    date: nextDateStr,
                    displayDate: nextDateStr,
                    status: "Booked",
                    invoiceAmount: "",
                    invoiceStatus: "",
                    invoiceNote: "",
                  }),
                });
              } catch (e) { console.error("Failed to create next booking", e); }
            }
          }
        }
        await loadAdminBookings();
        setSelectedAdminBooking(null);
        setCompleteAmount("");
        setCompleteNote("");
      } else { alert("Something went wrong. Please try again."); }
    } catch (e) { alert("Something went wrong."); }
    finally { setCompleteLoading(false); }
  }

  async function handleSaveEdit() {
    if (!editingBooking) return;
    setEditSaving(true);
    try {
      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "updateBookingFields",
          rowIndex: editingBooking.rowIndex,
          fields: editFields,
        }),
      });
      const data = await res.json();
      if (data.success) { await loadAdminBookings(); setEditingBooking(null); setEditFields({}); }
      else { alert("Something went wrong."); }
    } catch (e) { alert("Something went wrong."); }
    finally { setEditSaving(false); }
  }

  async function handleReleaseInvoice(booking: Booking) {
    try {
      const ok = await updateBooking(booking.rowIndex, { invoiceStatus: "released" });
      if (ok) {
        // Send invoice email to customer
        try {
          await fetch(SCRIPT_URL, {
            method: "POST",
            body: JSON.stringify({
              action: "sendInvoiceEmail",
              customerName: booking.name,
              customerEmail: booking.email,
              invoiceAmount: booking.invoiceAmount,
              invoiceNote: booking.invoiceNote,
              serviceDate: booking.date,
            }),
          });
        } catch (emailErr) { console.error("Invoice email failed", emailErr); }
        await loadAdminBookings();
      } else { alert("Something went wrong."); }
    } catch (e) { alert("Something went wrong."); }
  }

  async function handleMarkPaid(booking: Booking) {
    try {
      const ok = await updateBooking(booking.rowIndex, { invoiceStatus: "paid" });
      if (ok) {
        // Send payment confirmed email
        try {
          await fetch(SCRIPT_URL, {
            method: "POST",
            body: JSON.stringify({
              action: "sendPaymentConfirmedEmail",
              customerName: booking.name,
              customerEmail: booking.email,
              invoiceAmount: booking.invoiceAmount,
              serviceDate: booking.date,
            }),
          });
        } catch (emailErr) { console.error("Payment confirmed email failed", emailErr); }
        await loadAdminBookings();
      } else { alert("Something went wrong."); }
    } catch (e) { alert("Something went wrong."); }
  }

  async function handleSquareRequest(booking: Booking) {
    setSquareBooking(booking);
    setSquarePopup(true);
    // Send email to admin
    try {
      await fetch(SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "squareInvoiceRequest",
          customerName: booking.name,
          customerEmail: booking.email,
          amount: booking.invoiceAmount,
          date: booking.date,
        }),
      });
    } catch (e) { console.error("Square request email failed", e); }
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
    if (clientType === "maintenance") return "2 hours";
    if (vehicle === "truckSuv") return "3-5 hours avg";
    return pkg === "premium" ? "3-5 hours avg" : "3-4 hours avg";
  }, [vehicle, pkg, clientType]);

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

  // A booking is "done" if admin explicitly marked it Completed
  // (regardless of invoice — a past date with no status is also done)
  const isDone = (b: Booking) => b.status === "Completed";

  // Standard bookings: upcoming = future date and not done
  const upcomingStandard = standardBookings
    .filter((b) => isUpcoming(b.date) && !isDone(b))
    .sort((a, b) => a.date.localeCompare(b.date));
  const pastStandard = standardBookings
    .filter((b) => !isUpcoming(b.date) || isDone(b))
    .sort((a, b) => b.date.localeCompare(a.date));

  // Maintenance bookings: upcoming = future date and not done
  const upcomingMaintenance = maintenanceBookings
    .filter((b) => isUpcoming(b.date) && !isDone(b))
    .sort((a, b) => a.date.localeCompare(b.date));
  const pastMaintenance = maintenanceBookings
    .filter((b) => !isUpcoming(b.date) || isDone(b))
    .sort((a, b) => b.date.localeCompare(a.date));

  // For maintenance clients: calculate next upcoming dates beyond what's booked
  // This handles the case where future rows don't exist yet in the sheet
  const nextMaintenanceDates: { dateLabel: string; freq: string }[] = (() => {
    if (!isMaintenance) return [];
    // Find the most recent maintenance booking (completed or not) to get cadence info
    const allSorted = [...maintenanceBookings].sort((a, b) => b.date.localeCompare(a.date));
    if (allSorted.length === 0) return [];
    const ref = allSorted[0];
    if (!ref.recurringFrequency || !ref.date) return [];
    // Get all dates already booked (upcoming and not done)
    const bookedUpcoming = new Set(upcomingMaintenance.map(b => b.date));
    if (bookedUpcoming.size > 0) return []; // already have upcoming rows, no need to calculate
    // No upcoming rows exist — calculate next date from the most recent completed booking
    const nextDates = calcRecurringDates(ref.date, ref.recurringFrequency, 3);
    return nextDates
      .filter(() => {
        // Convert label back to a date to check if it's in the future
        // calcRecurringDates returns formatted labels like "Mon, Apr 27, 2026"
        // We just show them — they are by definition future dates
        return true;
      })
      .map(d => ({ dateLabel: d, freq: ref.recurringFrequency }));
  })();

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
            <button
              onClick={() => window.google?.accounts?.id?.prompt()}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "#fff",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                padding: "8px 14px",
                fontSize: "0.9rem",
                fontWeight: 600,
                cursor: "pointer",
                color: "#374151",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              }}
            >
              <img
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                alt="Google"
                style={{ width: 18, height: 18 }}
              />
              Sign in with Google
            </button>
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

  // SQUARE POPUP MODAL — defined here so it's available in all views
  const SquarePopup = () => squarePopup ? (
    <div style={{ position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 28, maxWidth: 400, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <h3 style={{ margin: "0 0 12px", fontWeight: 800, color: "#111827" }}>Square Invoice Request</h3>
        <p style={{ color: "#6b7280", fontSize: "0.95rem", lineHeight: 1.6, margin: "0 0 20px" }}>
          We received your request. We will send you a Square invoice to <strong>{squareBooking?.email}</strong> shortly so you can pay by credit or debit card.
        </p>
        <p style={{ color: "#9ca3af", fontSize: "0.82rem", margin: "0 0 20px" }}>Note: A 4% processing fee applies to card payments.</p>
        <button onClick={() => { setSquarePopup(false); setSquareBooking(null); }} style={{ background: "#111827", color: "#fff", border: "none", borderRadius: 12, padding: "12px 20px", fontWeight: 700, cursor: "pointer", width: "100%" }}>Got it</button>
      </div>
    </div>
  ) : null;

  // MY BOOKINGS VIEW
  if (view === "myBookings") {
    return (
      <div style={S.page}>
        <div style={S.container}>
          <Header />
          <SquarePopup />
          <div style={S.card}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, flexWrap: "wrap" as const }}>
              <button onClick={() => setView("booking")} style={{ ...S.secondary, padding: "9px 14px", fontSize: "0.9rem" }}>Back</button>
              <h2 style={{ ...S.title, margin: 0, fontSize: "1.8rem" }}>My Bookings</h2>
              <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                {googleUser?.email === ADMIN_EMAIL && (
                  <button onClick={() => { setView("admin"); loadAdminBookings(); }} style={{ ...S.secondary, padding: "10px 16px", fontSize: "0.9rem" }}>Admin</button>
                )}
                <button onClick={() => { setView("booking"); setStep(1); }} style={{ ...S.primary, padding: "10px 16px", fontSize: "0.9rem" }}>Book New Service</button>
              </div>
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
              <button onClick={() => setBookingsTab("balance" as any)} style={{ background: "none", border: "none", cursor: "pointer", padding: "10px 18px", fontSize: "0.95rem", fontWeight: 700, color: (bookingsTab as string) === "balance" ? "#d97706" : "#9ca3af", borderBottom: (bookingsTab as string) === "balance" ? "3px solid #d97706" : "3px solid transparent", marginBottom: -2 }}>
                Balance
              </button>
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
                    {(upcomingMaintenance.length > 0 || nextMaintenanceDates.length > 0) && (
                      <>
                        <div style={{ fontWeight: 700, color: "#374151", fontSize: "0.95rem", marginBottom: 12, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>Upcoming</div>
                        <div style={{ display: "grid", gap: 14, marginBottom: 28 }}>
                          {upcomingMaintenance.map((b, i) => (
                            <MaintenanceCard key={i} booking={b} onRequestChange={(b) => { setChangeTarget(b); setChangeNote(""); setChangeSubmitted(false); setView("requestChange"); }} />
                          ))}
                          {/* Show calculated next dates if no upcoming rows exist yet */}
                          {upcomingMaintenance.length === 0 && nextMaintenanceDates.map((nd, i) => (
                            <div key={i} style={{ background: "#fff", border: "1.5px solid #059669", borderRadius: 16, padding: 18 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                                <div style={{ fontSize: "1rem", fontWeight: 700, color: "#111827" }}>{nd.dateLabel}</div>
                                <span style={{ background: "#ecfdf5", color: "#059669", fontSize: "0.72rem", fontWeight: 700, borderRadius: 999, padding: "3px 9px", whiteSpace: "nowrap" as const }}>
                                  {nd.freq === "biweekly" ? "BI-WEEKLY" : "MONTHLY"}
                                </span>
                              </div>
                              <div style={{ fontSize: "0.85rem", color: "#9ca3af" }}>Next scheduled service — booking details will be confirmed by ATX Prestige Detailing.</div>
                            </div>
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

            {/* Balance tab */}
            {(bookingsTab as string) === "balance" && (
              <>
                {(() => {
                  const releasedInvoices = userBookings.filter(b => b.invoiceStatus === "released" || b.invoiceStatus === "paid");
                  const outstanding = releasedInvoices.filter(b => b.invoiceStatus === "released");
                  const paid = releasedInvoices.filter(b => b.invoiceStatus === "paid");
                  const totalOwed = outstanding.reduce((sum, b) => sum + parseFloat(b.invoiceAmount || "0"), 0);

                  return (
                    <>
                      {outstanding.length === 0 && paid.length === 0 && (
                        <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>No invoices on file yet.</div>
                      )}

                      {outstanding.length > 0 && (
                        <>
                          <div style={{ background: "#fefce8", border: "1px solid #fde047", borderRadius: 14, padding: "14px 18px", marginBottom: 20 }}>
                            <div style={{ fontWeight: 700, color: "#713f12", fontSize: "1rem", marginBottom: 8 }}>Total Balance Due</div>
                            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" as const }}>
                              <div>
                                <div style={{ fontSize: "0.78rem", color: "#92400e" }}>Venmo / Cash App</div>
                                <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#92400e" }}>${totalOwed.toFixed(2)}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: "0.78rem", color: "#92400e" }}>Square / Card (+ 4%)</div>
                                <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#92400e" }}>${(totalOwed * 1.04).toFixed(2)}</div>
                              </div>
                            </div>
                          </div>

                          {outstanding.map((b, i) => {
                            const baseAmt = parseFloat(b.invoiceAmount || "0");
                            const squareAmt = (baseAmt * 1.04).toFixed(2);
                            return (
                            <div key={i} style={{ background: "#fff", border: "1px solid #fde047", borderRadius: 16, padding: 18, marginBottom: 14 }}>
                              <div style={{ fontWeight: 700, color: "#111827", marginBottom: 4 }}>{formatDateLabel(b.date)} — {b.packageType === "basic" ? "Basic Detail" : "Premium Detail"}</div>
                              <div style={{ fontSize: "0.9rem", color: "#6b7280", marginBottom: 10 }}>
                                {[b.year, b.make, b.model, b.boatSize].filter(Boolean).join(" ")}
                                {b.invoiceNote ? ` — ${b.invoiceNote}` : ""}
                              </div>
                              {/* Amount due box showing both prices */}
                              <div style={{ background: "#fefce8", border: "1px solid #fde047", borderRadius: 12, padding: "12px 16px", marginBottom: 14, display: "flex", gap: 16, flexWrap: "wrap" as const, alignItems: "center" }}>
                                <div style={{ textAlign: "center" as const }}>
                                  <div style={{ fontSize: "0.75rem", color: "#92400e", marginBottom: 2 }}>Venmo / Cash App</div>
                                  <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#92400e" }}>${baseAmt.toFixed(2)}</div>
                                  <div style={{ fontSize: "0.7rem", color: "#9ca3af" }}>No fee</div>
                                </div>
                                <div style={{ color: "#d1d5db", fontSize: "1.2rem" }}>|</div>
                                <div style={{ textAlign: "center" as const }}>
                                  <div style={{ fontSize: "0.75rem", color: "#92400e", marginBottom: 2 }}>Square (Card)</div>
                                  <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#92400e" }}>${squareAmt}</div>
                                  <div style={{ fontSize: "0.7rem", color: "#9ca3af" }}>Includes 4% fee</div>
                                </div>
                              </div>

                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                                <div>
                                  <a href={VENMO_URL} target="_blank" rel="noopener noreferrer" style={{ display: "block", background: "#008CFF", color: "#fff", borderRadius: 10, padding: "8px 6px", textAlign: "center", textDecoration: "none", fontWeight: 700, fontSize: "0.82rem" }}>Venmo</a>
                                  <div style={{ fontSize: "0.72rem", color: "#6b7280", textAlign: "center" as const, marginTop: 3 }}>${baseAmt.toFixed(2)}</div>
                                </div>
                                <div>
                                  <a href={CASHAPP_URL} target="_blank" rel="noopener noreferrer" style={{ display: "block", background: "#00C244", color: "#fff", borderRadius: 10, padding: "8px 6px", textAlign: "center", textDecoration: "none", fontWeight: 700, fontSize: "0.82rem" }}>Cash App</a>
                                  <div style={{ fontSize: "0.72rem", color: "#6b7280", textAlign: "center" as const, marginTop: 3 }}>${baseAmt.toFixed(2)}</div>
                                </div>
                                <div>
                                  <button onClick={() => handleSquareRequest(b)} style={{ display: "block", width: "100%", background: "#111827", color: "#fff", border: "none", borderRadius: 10, padding: "8px 6px", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer" }}>Card (Square)</button>
                                  <div style={{ fontSize: "0.72rem", color: "#6b7280", textAlign: "center" as const, marginTop: 3 }}>${squareAmt}</div>
                                </div>
                              </div>
                            </div>
                            );
                          })}
                        </>
                      )}

                      {paid.length > 0 && (
                        <>
                          <div style={{ fontWeight: 700, color: "#9ca3af", fontSize: "0.85rem", textTransform: "uppercase" as const, letterSpacing: "0.04em", marginTop: 16, marginBottom: 10 }}>Paid</div>
                          {paid.map((b, i) => (
                            <div key={i} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 14, padding: 14, marginBottom: 10 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                  <div style={{ fontWeight: 600, color: "#374151", fontSize: "0.9rem" }}>{formatDateLabel(b.date)}</div>
                                  <div style={{ fontSize: "0.85rem", color: "#9ca3af" }}>{b.packageType === "basic" ? "Basic Detail" : "Premium Detail"}</div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <span style={{ fontWeight: 700, color: "#374151" }}>${b.invoiceAmount}</span>
                                  <span style={{ background: "#dcfce7", color: "#166534", fontSize: "0.72rem", fontWeight: 700, borderRadius: 999, padding: "2px 8px" }}>PAID</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </>
                  );
                })()}
              </>
            )}

          </div>
        </div>
      </div>
    );
  }

  // ADMIN VIEW
  if (view === "admin" && googleUser?.email === ADMIN_EMAIL) {
    const filtered = adminBookings.filter(b => {
      if (adminFilter === "upcoming") return isUpcoming(b.date) && b.status !== "Completed";
      if (adminFilter === "past") return !isUpcoming(b.date) || b.status === "Completed";
      if (adminFilter === "maintenance") return b.clientType === "maintenance";
      return true;
    });

    const pendingInvoices = adminBookings.filter(b => b.invoiceStatus === "pending");
    const releasedInvoices = adminBookings.filter(b => b.invoiceStatus === "released");
    const paidInvoices = adminBookings.filter(b => b.invoiceStatus === "paid");

    return (
      <div style={S.page}>
        <div style={S.container}>
          <Header />
          <SquarePopup />
          <div style={S.card}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, flexWrap: "wrap" as const }}>
              <button onClick={() => setView("myBookings")} style={{ ...S.secondary, padding: "9px 14px", fontSize: "0.9rem" }}>Back</button>
              <h2 style={{ ...S.title, margin: 0, fontSize: "1.8rem" }}>Admin</h2>
              <button onClick={loadAdminBookings} style={{ ...S.secondary, marginLeft: "auto", padding: "9px 14px", fontSize: "0.9rem" }}>Refresh</button>
            </div>

            {/* Admin tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "2px solid #e5e7eb" }}>
              <button onClick={() => setAdminTab("bookings")} style={{ background: "none", border: "none", cursor: "pointer", padding: "10px 18px", fontSize: "0.95rem", fontWeight: 700, color: adminTab === "bookings" ? "#111827" : "#9ca3af", borderBottom: adminTab === "bookings" ? "3px solid #111827" : "3px solid transparent", marginBottom: -2 }}>All Bookings</button>
              <button onClick={() => setAdminTab("invoices")} style={{ background: "none", border: "none", cursor: "pointer", padding: "10px 18px", fontSize: "0.95rem", fontWeight: 700, color: adminTab === "invoices" ? "#d97706" : "#9ca3af", borderBottom: adminTab === "invoices" ? "3px solid #d97706" : "3px solid transparent", marginBottom: -2 }}>
                Invoices {pendingInvoices.length > 0 && <span style={{ background: "#ef4444", color: "#fff", borderRadius: 999, padding: "1px 6px", fontSize: "0.72rem", marginLeft: 4 }}>{pendingInvoices.length}</span>}
              </button>
            </div>

            {adminLoading ? (
              <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>Loading...</div>
            ) : (
              <>
                {/* All Bookings tab */}
                {adminTab === "bookings" && (
                  <>
                    {/* Filter bar */}
                    <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" as const }}>
                      {(["all", "upcoming", "past", "maintenance"] as const).map(f => (
                        <button key={f} onClick={() => setAdminFilter(f)} style={{ background: adminFilter === f ? "#111827" : "#f3f4f6", color: adminFilter === f ? "#fff" : "#374151", border: "none", borderRadius: 999, padding: "6px 14px", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", textTransform: "capitalize" as const }}>
                          {f === "all" ? "All" : f === "upcoming" ? "Upcoming" : f === "past" ? "Past" : "Maintenance"}
                        </button>
                      ))}
                    </div>
                    {/* Maintenance schedule summary — all upcoming grouped by client */}
                    {adminFilter === "maintenance" && (() => {
                      const futureMain = adminBookings.filter(b => b.clientType === "maintenance" && isUpcoming(b.date) && b.status !== "Completed");
                      const grouped: Record<string, Booking[]> = {};
                      futureMain.forEach(b => {
                        if (!grouped[b.email]) grouped[b.email] = [];
                        grouped[b.email].push(b);
                      });
                      return Object.keys(grouped).length > 0 ? (
                        <div style={{ marginBottom: 20 }}>
                          <div style={{ fontWeight: 700, color: "#374151", fontSize: "0.85rem", textTransform: "uppercase" as const, letterSpacing: "0.04em", marginBottom: 10 }}>Maintenance Schedule Overview</div>
                          {Object.entries(grouped).map(([email, bookings]) => {
                            const sorted = [...bookings].sort((a, b) => a.date.localeCompare(b.date));
                            return (
                              <div key={email} style={{ background: "#ecfdf5", border: "1px solid #6ee7b7", borderRadius: 12, padding: "14px 16px", marginBottom: 10 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" as const, gap: 4, marginBottom: 8 }}>
                                  <div>
                                    <div style={{ fontWeight: 700, color: "#065f46", fontSize: "0.95rem" }}>{sorted[0].name}</div>
                                    <div style={{ fontSize: "0.82rem", color: "#047857" }}>{email}</div>
                                  </div>
                                  <span style={{ background: "#fff", border: "1px solid #6ee7b7", borderRadius: 999, padding: "2px 10px", fontSize: "0.78rem", fontWeight: 700, color: "#059669" }}>
                                    {sorted[0].recurringFrequency === "biweekly" ? "Bi-Weekly" : "Monthly"}
                                  </span>
                                </div>
                                <div style={{ display: "grid", gap: 6 }}>
                                  {sorted.map((b, i) => (
                                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", borderRadius: 8, padding: "7px 12px", fontSize: "0.85rem" }}>
                                      <span style={{ color: "#065f46", fontWeight: 600 }}>{i === 0 ? "Next: " : (i + 1) + ". "}{formatDateLabel(b.date)}{b.time ? ` at ${b.time}` : ""}</span>
                                      <span style={{ color: "#6b7280", fontSize: "0.78rem" }}>{b.packageType === "basic" ? "Basic" : "Premium"}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : null;
                    })()}

                    {filtered.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>No bookings found.</div>}

                    <div style={{ display: "grid", gap: 12 }}>
                      {filtered.map((b, i) => {
                        const vl = b.vehicle === "boat" ? [b.boatSize, b.make, b.model].filter(Boolean).join(" ") : [b.year, b.make, b.model].filter(Boolean).join(" ");
                        const isComplete = b.status === "Completed";
                        const isSelected = selectedAdminBooking?.rowIndex === b.rowIndex;

                        return (
                          <div key={i} style={{ background: "#fff", border: `1.5px solid ${isComplete ? "#e5e7eb" : isUpcoming(b.date) ? "#2563eb" : "#e5e7eb"}`, borderRadius: 14, padding: 16 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6, flexWrap: "wrap" as const }}>
                              <div>
                                <div style={{ fontWeight: 700, color: "#111827", fontSize: "0.95rem" }}>{b.name} — {formatDateLabel(b.date)}{b.time ? ` at ${b.time}` : ""}</div>
                                <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>{b.email} · {b.phone}</div>
                                <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>{vl} · {b.packageType === "basic" ? "Basic" : "Premium"} · ${b.hourlyRate}/hr</div>
                                {b.clientType === "maintenance" && <div style={{ fontSize: "0.8rem", color: "#059669", fontWeight: 600 }}>{b.recurringFrequency === "biweekly" ? "Bi-Weekly" : "Monthly"} Maintenance</div>}
                                {b.serviceType === "mobile" && b.address && <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>{b.address}</div>}
                                {b.notes && <div style={{ fontSize: "0.8rem", color: "#9ca3af" }}>Notes: {b.notes}</div>}
                              </div>
                              <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "flex-end", gap: 4 }}>
                                <span style={{ background: isComplete ? "#dcfce7" : isUpcoming(b.date) ? "#eff6ff" : "#f3f4f6", color: isComplete ? "#166534" : isUpcoming(b.date) ? "#2563eb" : "#9ca3af", fontSize: "0.72rem", fontWeight: 700, borderRadius: 999, padding: "2px 8px" }}>
                                  {isComplete ? "COMPLETED" : isUpcoming(b.date) ? "UPCOMING" : "PAST"}
                                </span>
                                {b.invoiceStatus && b.invoiceStatus !== "" && (
                                  <span style={{ background: b.invoiceStatus === "paid" ? "#dcfce7" : b.invoiceStatus === "released" ? "#fef9c3" : "#fef3c7", color: b.invoiceStatus === "paid" ? "#166534" : "#92400e", fontSize: "0.72rem", fontWeight: 700, borderRadius: 999, padding: "2px 8px" }}>
                                    {b.invoiceStatus === "pending" ? "INVOICE PENDING" : b.invoiceStatus === "released" ? `INVOICE SENT $${b.invoiceAmount}` : `PAID $${b.invoiceAmount}`}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, marginTop: 8, alignItems: "center" }}>
                              {!isComplete && (
                                <button onClick={() => { setSelectedAdminBooking(isSelected ? null : b); setCompleteAmount(b.hourlyRate ? String(parseFloat(b.hourlyRate) * 2) : ""); setCompleteNote(""); setEditingBooking(null); }}
                                  style={{ background: isSelected ? "#f3f4f6" : "#111827", color: isSelected ? "#111827" : "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}>
                                  {isSelected ? "Cancel" : "Mark Complete"}
                                </button>
                              )}
                              <button onClick={() => { setEditingBooking(editingBooking?.rowIndex === b.rowIndex ? null : b); setEditFields({ name: b.name, phone: b.phone, email: b.email, date: b.date, time: b.time, year: b.year, make: b.make, model: b.model, boatSize: b.boatSize, packageType: b.packageType, serviceType: b.serviceType, address: b.address, notes: b.notes, clientType: b.clientType, recurringFrequency: b.recurringFrequency }); setSelectedAdminBooking(null); }}
                                style={{ background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}>
                                {editingBooking?.rowIndex === b.rowIndex ? "Cancel Edit" : "Edit"}
                              </button>
                            </div>

                            {/* Edit form */}
                            {editingBooking?.rowIndex === b.rowIndex && (
                              <div style={{ marginTop: 14, padding: 16, background: "#f9fafb", borderRadius: 12, border: "1px solid #e5e7eb" }}>
                                <div style={{ fontWeight: 700, color: "#374151", marginBottom: 12 }}>Edit Booking</div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                                  {[
                                    { label: "Name", key: "name" },
                                    { label: "Phone", key: "phone" },
                                    { label: "Email", key: "email" },
                                    { label: "Date (YYYY-MM-DD)", key: "date" },
                                    { label: "Time", key: "time" },
                                    { label: "Year", key: "year" },
                                    { label: "Make", key: "make" },
                                    { label: "Model", key: "model" },
                                    { label: "Boat Size", key: "boatSize" },
                                    { label: "Address", key: "address" },
                                    { label: "Notes", key: "notes" },
                                  ].map(field => (
                                    <div key={field.key}>
                                      <div style={{ fontSize: "0.78rem", color: "#6b7280", marginBottom: 3 }}>{field.label}</div>
                                      <input
                                        style={{ ...S.input, padding: "8px 10px", fontSize: "0.85rem" }}
                                        value={(editFields as any)[field.key] || ""}
                                        onChange={e => setEditFields(prev => ({ ...prev, [field.key]: e.target.value }))}
                                      />
                                    </div>
                                  ))}
                                  <div>
                                    <div style={{ fontSize: "0.78rem", color: "#6b7280", marginBottom: 3 }}>Package</div>
                                    <select style={{ ...S.input, padding: "8px 10px", fontSize: "0.85rem", backgroundColor: "#fff" }} value={(editFields as any).packageType || ""} onChange={e => setEditFields(prev => ({ ...prev, packageType: e.target.value }))}>
                                      <option value="basic">Basic</option>
                                      <option value="premium">Premium</option>
                                    </select>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: "0.78rem", color: "#6b7280", marginBottom: 3 }}>Service Type</div>
                                    <select style={{ ...S.input, padding: "8px 10px", fontSize: "0.85rem", backgroundColor: "#fff" }} value={(editFields as any).serviceType || ""} onChange={e => setEditFields(prev => ({ ...prev, serviceType: e.target.value }))}>
                                      <option value="mobile">Mobile</option>
                                      <option value="dropoff">Drop-Off</option>
                                    </select>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: "0.78rem", color: "#6b7280", marginBottom: 3 }}>Client Type</div>
                                    <select style={{ ...S.input, padding: "8px 10px", fontSize: "0.85rem", backgroundColor: "#fff" }} value={(editFields as any).clientType || ""} onChange={e => setEditFields(prev => ({ ...prev, clientType: e.target.value }))}>
                                      <option value="oneTime">One-Time</option>
                                      <option value="maintenance">Maintenance</option>
                                    </select>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: "0.78rem", color: "#6b7280", marginBottom: 3 }}>Frequency</div>
                                    <select style={{ ...S.input, padding: "8px 10px", fontSize: "0.85rem", backgroundColor: "#fff" }} value={(editFields as any).recurringFrequency || ""} onChange={e => setEditFields(prev => ({ ...prev, recurringFrequency: e.target.value }))}>
                                      <option value="">None</option>
                                      <option value="biweekly">Bi-Weekly</option>
                                      <option value="monthly">Monthly</option>
                                    </select>
                                  </div>
                                </div>
                                <div style={{ display: "flex", gap: 8 }}>
                                  <button onClick={handleSaveEdit} disabled={editSaving}
                                    style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer", opacity: editSaving ? 0.5 : 1 }}>
                                    {editSaving ? "Saving..." : "Save Changes"}
                                  </button>
                                  <button onClick={() => { setEditingBooking(null); setEditFields({}); }}
                                    style={{ background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 8, padding: "9px 14px", fontWeight: 600, fontSize: "0.88rem", cursor: "pointer" }}>
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Mark complete form */}
                            {isSelected && (
                              <div style={{ marginTop: 14, padding: 16, background: "#f9fafb", borderRadius: 12, border: "1px solid #e5e7eb" }}>
                                <div style={{ fontWeight: 700, color: "#374151", marginBottom: 10 }}>Confirm Service & Set Invoice</div>
                                <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" as const }}>
                                  <div style={{ flex: 1, minWidth: 120 }}>
                                    <div style={{ fontSize: "0.82rem", color: "#6b7280", marginBottom: 4 }}>Amount ($)</div>
                                    <input style={{ ...S.input, padding: "10px 12px" }} type="number" placeholder="0.00" value={completeAmount} onChange={e => setCompleteAmount(e.target.value)} />
                                  </div>
                                  <div style={{ flex: 2, minWidth: 180 }}>
                                    <div style={{ fontSize: "0.82rem", color: "#6b7280", marginBottom: 4 }}>Note (optional)</div>
                                    <input style={{ ...S.input, padding: "10px 12px" }} placeholder="e.g. 2 hrs at $80/hr" value={completeNote} onChange={e => setCompleteNote(e.target.value)} />
                                  </div>
                                </div>
                                <div style={{ fontSize: "0.8rem", color: "#9ca3af", marginBottom: 10 }}>This creates a pending invoice. You must release it from the Invoices tab before the client can see it.</div>
                                <button onClick={handleMarkComplete} disabled={!completeAmount || completeLoading}
                                  style={{ background: "#059669", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer", opacity: !completeAmount || completeLoading ? 0.5 : 1 }}>
                                  {completeLoading ? "Saving..." : "Confirm Complete"}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* Invoices tab */}
                {adminTab === "invoices" && (
                  <>
                    {pendingInvoices.length > 0 && (
                      <>
                        <div style={{ fontWeight: 700, color: "#92400e", fontSize: "0.85rem", textTransform: "uppercase" as const, letterSpacing: "0.04em", marginBottom: 10 }}>Pending Review — Not Visible to Client</div>
                        <div style={{ display: "grid", gap: 10, marginBottom: 24 }}>
                          {pendingInvoices.map((b, i) => (
                            <div key={i} style={{ background: "#fff", border: "1px solid #fde68a", borderRadius: 14, padding: 16 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" as const, gap: 8 }}>
                                <div>
                                  <div style={{ fontWeight: 700, color: "#111827" }}>{b.name} — {formatDateLabel(b.date)}</div>
                                  <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>{b.email}</div>
                                  {b.invoiceNote && <div style={{ fontSize: "0.85rem", color: "#9ca3af" }}>{b.invoiceNote}</div>}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <span style={{ fontWeight: 800, color: "#92400e", fontSize: "1.1rem" }}>${b.invoiceAmount}</span>
                                  <button onClick={() => handleReleaseInvoice(b)} style={{ background: "#111827", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" }}>Release to Client</button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {releasedInvoices.length > 0 && (
                      <>
                        <div style={{ fontWeight: 700, color: "#374151", fontSize: "0.85rem", textTransform: "uppercase" as const, letterSpacing: "0.04em", marginBottom: 10 }}>Sent to Client — Awaiting Payment</div>
                        <div style={{ display: "grid", gap: 10, marginBottom: 24 }}>
                          {releasedInvoices.map((b, i) => (
                            <div key={i} style={{ background: "#fff", border: "1px solid #fde047", borderRadius: 14, padding: 16 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" as const, gap: 8 }}>
                                <div>
                                  <div style={{ fontWeight: 700, color: "#111827" }}>{b.name} — {formatDateLabel(b.date)}</div>
                                  <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>{b.email}</div>
                                  {b.invoiceNote && <div style={{ fontSize: "0.85rem", color: "#9ca3af" }}>{b.invoiceNote}</div>}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <span style={{ fontWeight: 800, color: "#92400e", fontSize: "1.1rem" }}>${b.invoiceAmount}</span>
                                  <button onClick={() => handleMarkPaid(b)} style={{ background: "#059669", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" }}>Mark Paid</button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {paidInvoices.length > 0 && (
                      <>
                        <div style={{ fontWeight: 700, color: "#9ca3af", fontSize: "0.85rem", textTransform: "uppercase" as const, letterSpacing: "0.04em", marginBottom: 10 }}>Paid</div>
                        <div style={{ display: "grid", gap: 10 }}>
                          {paidInvoices.map((b, i) => (
                            <div key={i} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 14, padding: 14 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                  <div style={{ fontWeight: 600, color: "#374151" }}>{b.name} — {formatDateLabel(b.date)}</div>
                                  <div style={{ fontSize: "0.82rem", color: "#9ca3af" }}>{b.email}</div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <span style={{ fontWeight: 700, color: "#374151" }}>${b.invoiceAmount}</span>
                                  <span style={{ background: "#dcfce7", color: "#166534", fontSize: "0.72rem", fontWeight: 700, borderRadius: 999, padding: "2px 8px" }}>PAID</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {pendingInvoices.length === 0 && releasedInvoices.length === 0 && paidInvoices.length === 0 && (
                      <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>No invoices yet. Mark a service complete to create one.</div>
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
        <SquarePopup />
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
                {vehicle !== "boat" && (
                  <button
                    style={{ ...S.optionCard, ...(clientType === "maintenance" ? S.selectedGreen : {}) }}
                    onClick={() => setClientType("maintenance")}
                  >
                    <div style={{ ...S.optionTitle, color: clientType === "maintenance" ? "#065f46" : "#111827" }}>Maintenance Plan</div>
                    <div style={S.optionMeta}>Recurring 2-hour details to keep your vehicle in top condition. Choose bi-weekly or monthly.</div>
                  </button>
                )}
              </div>

              {vehicle === "boat" && (
                <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 14, padding: "12px 16px", marginBottom: 8, fontSize: "0.9rem", color: "#6b7280" }}>
                  Maintenance plans are not available for boats. Please select One-Time Service.
                </div>
              )}

              {clientType === "maintenance" && vehicle !== "boat" && (
                <div style={{ marginTop: 4, marginBottom: 8 }}>
                  <div style={{ background: "#fefce8", border: "1px solid #fde68a", borderRadius: 14, padding: "12px 16px", marginBottom: 16, fontSize: "0.9rem", color: "#92400e", lineHeight: 1.6 }}>
                    To sign up for a maintenance plan, you must have had a detail with us within the last 30 days. If you have not booked yet, select One-Time Service first.
                  </div>
                  <div style={{ fontWeight: 700, color: "#374151", fontSize: "0.95rem", marginBottom: 12, textAlign: "center" as const }}>
                    How often would you like service?
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <button
                      style={{ ...S.optionCard, ...(frequency === "biweekly" ? S.selectedGreen : {}), textAlign: "center" as const }}
                      onClick={() => setFrequency("biweekly")}
                    >
                      <div style={{ ...S.optionTitle, textAlign: "center" as const, color: frequency === "biweekly" ? "#065f46" : "#111827" }}>Bi-Weekly</div>
                      <div style={S.optionMeta}>Every two weeks. Good for high-use vehicles.</div>
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
                    : clientType === "maintenance" ? "2 hours"
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

                {/* Recurring schedule preview — maintenance only */}
                {clientType === "maintenance" && selectedDate && frequency && (
                  <div style={{ background: "#ecfdf5", border: "1px solid #6ee7b7", borderRadius: 14, padding: "14px 16px", marginTop: 4 }}>
                    <div style={{ fontWeight: 700, color: "#065f46", marginBottom: 8, fontSize: "0.95rem" }}>
                      Your Recurring Schedule
                    </div>
                    <div style={{ fontSize: "0.88rem", color: "#047857", marginBottom: 8 }}>
                      {getCadenceLabel(selectedDate, frequency)} starting {formatDateLabel(selectedDate)}
                    </div>
                    <div style={{ display: "grid", gap: 4 }}>
                      {calcRecurringDates(selectedDate, frequency, 6).map((d, i) => (
                        <div key={i} style={{ fontSize: "0.88rem", color: "#065f46" }}>
                          {i + 2}. {d}
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: "0.82rem", color: "#6b7280", marginTop: 8 }}>
                      Showing your next 6 scheduled dates. These slots will be held for you.
                    </div>
                  </div>
                )}

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
                    {/* Year — free text with suggestions */}
                    <input
                      style={{ ...S.input, flex: 1, minWidth: 120 }}
                      placeholder="Year"
                      value={year}
                      onChange={(e) => { setYear(e.target.value); setModel(""); setModelOptions([]); }}
                      list="year-options"
                    />
                    <datalist id="year-options">
                      {yearOptions.map((yr) => <option key={yr} value={yr} />)}
                    </datalist>

                    {/* Make — free text with API suggestions */}
                    <input
                      style={{ ...S.input, flex: 2, minWidth: 180 }}
                      placeholder={loadingMakes ? "Loading..." : "Make"}
                      value={make}
                      onChange={(e) => { setMake(e.target.value); setModel(""); setModelOptions([]); }}
                      list="make-options"
                      autoComplete="off"
                    />
                    <datalist id="make-options">
                      {makeOptions.map((mk) => <option key={mk} value={mk} />)}
                    </datalist>

                    {/* Model — free text with API suggestions */}
                    <input
                      style={{ ...S.input, flex: 2, minWidth: 180 }}
                      placeholder={!year || !make ? "Enter year and make first" : loadingModels ? "Loading..." : "Model"}
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      list="model-options"
                      autoComplete="off"
                    />
                    <datalist id="model-options">
                      {modelOptions.map((mdl) => <option key={mdl} value={mdl} />)}
                    </datalist>
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
                    {clientType === "maintenance" && selectedDate && frequency && (
                      <><br /><span style={{ fontSize: "0.88rem", fontWeight: 400, color: "#059669" }}>{getCadenceLabel(selectedDate, frequency)}</span></>
                    )}
                  </div>
                </div>
                {clientType === "maintenance" && selectedDate && frequency && (
                  <div style={{ ...S.summaryCard, gridColumn: "1 / -1", background: "#f0fdf4", border: "1px solid #6ee7b7" }}>
                    <div style={S.summaryHeading}>Recurring Schedule</div>
                    <div style={{ fontSize: "0.9rem", color: "#065f46", fontWeight: 600, marginBottom: 8 }}>
                      {getCadenceLabel(selectedDate, frequency)} — first service {formatDateLabel(selectedDate)}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 4 }}>
                      {calcRecurringDates(selectedDate, frequency, 6).map((d, i) => (
                        <div key={i} style={{ fontSize: "0.88rem", color: "#374151" }}>{i + 2}. {d}</div>
                      ))}
                    </div>
                  </div>
                )}
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
                    {clientType === "maintenance" && selectedDate && frequency && (
                      <><br /><span style={{ fontSize: "0.88rem", fontWeight: 400, color: "#059669" }}>{getCadenceLabel(selectedDate, frequency)}</span></>
                    )}
                  </div>
                </div>
                {clientType === "maintenance" && selectedDate && frequency && (
                  <div style={{ ...S.summaryCard, gridColumn: "1 / -1", background: "#f0fdf4", border: "1px solid #6ee7b7" }}>
                    <div style={S.summaryHeading}>Recurring Schedule</div>
                    <div style={{ fontSize: "0.9rem", color: "#065f46", fontWeight: 600, marginBottom: 8 }}>
                      {getCadenceLabel(selectedDate, frequency)} — first service {formatDateLabel(selectedDate)}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 4 }}>
                      {calcRecurringDates(selectedDate, frequency, 6).map((d, i) => (
                        <div key={i} style={{ fontSize: "0.88rem", color: "#374151" }}>{i + 2}. {d}</div>
                      ))}
                    </div>
                  </div>
                )}
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