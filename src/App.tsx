import { useMemo, useState, useEffect } from "react";
import logo from "./assets/logo.png";
const SCRIPT_URL =
   "https://script.google.com/macros/s/AKfycbxrMC0eOl7GJ5V8MNb4l5Bd8X-4Hsb9Jj4E7-v9_2X_UTJBQngwerr8kck9xPiJwykHiQ/exec";
   type AvailabilitySlot = {
  date: string;
  time: string;
  available?: boolean;
  notes?: string;
};
 
async function fetchAllAvailability(): Promise<AvailabilitySlot[]> {
  const res = await fetch(`${SCRIPT_URL}?action=getAllAvailability`);
  const data: { slots: AvailabilitySlot[] } = await res.json();
  return data.slots || [];
}
type VehicleType = "truckSuv" | "sedan" | "coupe" | "";
type PackageType = "basic" | "premium" | "";
type ServiceType = "mobile" | "dropoff" | "";
type AddOn =
  | "Headlight Restoration"
  | "Stain Removal"
  | "Paint Correction"
  | "Pet Hair Removal"
  | "Steam Cleaning"
  | "Ceramic Coating";

const vehicleOptions = [
  {
    id: "truckSuv" as VehicleType,
    label: "Truck / SUV",
    basicRate: 80,
    premiumRate: 100,
  },
  {
    id: "sedan" as VehicleType,
    label: "Sedan",
    basicRate: 70,
    premiumRate: 90,
  },
  {
    id: "coupe" as VehicleType,
    label: "Coupe",
    basicRate: 65,
    premiumRate: 85,
  },
];

const addOnOptions: {
  label: AddOn;
  priceText: string;
  fixedPrice?: number;
}[] = [
  { label: "Headlight Restoration", priceText: "$150", fixedPrice: 150 },
  { label: "Stain Removal", priceText: "Need consultation" },
  { label: "Paint Correction", priceText: "Need consultation" },
  { label: "Pet Hair Removal", priceText: "$60", fixedPrice: 60 },
  { label: "Steam Cleaning", priceText: "$60", fixedPrice: 60 },
  { label: "Ceramic Coating", priceText: "Need consultation" },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function App() {
  const [step, setStep] = useState(0);
  const [vehicle, setVehicle] = useState<VehicleType>("");
  const [pkg, setPkg] = useState<PackageType>("");
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [serviceType, setServiceType] = useState<ServiceType>("");
  const [address, setAddress] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [year, setYear] = useState("");
const [make, setMake] = useState("");
const [model, setModel] = useState("");
const [selectedDate, setSelectedDate] = useState("");
const [availableSlots, setAvailableSlots] = useState<AvailabilitySlot[]>([]);
const [allAvailableSlots, setAllAvailableSlots] = useState<AvailabilitySlot[]>([]);
const [availableDates, setAvailableDates] = useState<string[]>([]);
const [selectedTime, setSelectedTime] = useState("");
useEffect(() => {
  const loadAllAvailability = async () => {
    try {
      const slots = await fetchAllAvailability();
      setAllAvailableSlots(slots);

      const uniqueDates = [...new Set(slots.map((slot) => slot.date))];
      setAvailableDates(uniqueDates);
    } catch (err) {
      console.error("Error loading all availability", err);
      setAllAvailableSlots([]);
      setAvailableDates([]);
    }
  };

  loadAllAvailability();
}, []);
useEffect(() => {
  if (!selectedDate) {
    setAvailableSlots([]);
    return;
  }

  const filtered = allAvailableSlots.filter((slot) => slot.date === selectedDate);
  setAvailableSlots(filtered);
}, [selectedDate, allAvailableSlots]);

  const selectedVehicle = vehicleOptions.find((v) => v.id === vehicle);

  const hourlyRate = useMemo(() => {
    if (!selectedVehicle || !pkg) return 0;
    return pkg === "basic" ? selectedVehicle.basicRate : selectedVehicle.premiumRate;
  }, [selectedVehicle, pkg]);

  const packageHours = useMemo(() => {
    if (!vehicle || !pkg) return "Select vehicle first";
    if (vehicle === "truckSuv") return "3–5 hours avg";
    if (vehicle === "sedan") return pkg === "premium" ? "3–5 hours avg" : "3–4 hours avg";
    if (vehicle === "coupe") return pkg === "premium" ? "3–5 hours avg" : "3–4 hours avg";
    return "3–5 hours avg";
  }, [vehicle, pkg]);

  const addOnEstimate = useMemo(() => {
    return addOns.reduce((sum, selected) => {
      const found = addOnOptions.find((option) => option.label === selected);
      return sum + (found?.fixedPrice ?? 0);
    }, 0);
  }, [addOns]);

  const estimateText = useMemo(() => {
    if (!hourlyRate) return "";
    return `${formatCurrency(hourlyRate)}/hr`;
  }, [hourlyRate]);

  const addOnSummaryText = useMemo(() => {
    if (!addOns.length) return "";
    return addOns.join(", ");
  }, [addOns]);

  function toggleAddOn(addOn: AddOn) {
    setAddOns((prev) =>
      prev.includes(addOn) ? prev.filter((item) => item !== addOn) : [...prev, addOn]
    );
  }

  function next() {
    setStep((s) => s + 1);
  }

  function back() {
    setStep((s) => s - 1);
  }

  const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #f7f7f8 0%, #efeff1 100%)",
    color: "#171717",
    padding: "32px 16px",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  } as const,
  container: {
    maxWidth: 920,
    margin: "0 auto",
  } as const,
 brand: {
  display: "flex",
  justifyContent: "center",
  marginBottom: 28,
} as const,
brandRow: {
  display: "grid",
  gridTemplateColumns: "100px auto",
  alignItems: "center",
  gap: 18,
  maxWidth: 780,
  width: "100%",
},


logo: {
  width: 96,
  height: 96,
  objectFit: "contain" as const,
  opacity: 1,
  filter: "drop-shadow(0 3px 10px rgba(0,0,0,0.12))",
},
 brandTitle: {
  fontSize: "2.6rem",
  fontWeight: 800,
  letterSpacing: "-0.8px",
  color: "#111827",
  margin: 0,
  lineHeight: 1.1,
},
 brandSub: {
  color: "#6b7280",
  fontSize: "1.05rem",
  marginTop: 8,
  marginBottom: 0,
  lineHeight: 1.4,
},
  progressWrap: {
    marginBottom: 20,
  },
  progressText: {
    display: "flex",
    justifyContent: "space-between",
    color: "#6b7280",
    fontSize: "0.9rem",
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    background: "#e5e7eb",
    borderRadius: 999,
    overflow: "hidden",
    border: "1px solid #d1d5db",
  } as const,
  progressFill: {
    height: "100%",
    width: `${((step + 1) / 8) * 100}%`,
    background: "linear-gradient(90deg, #6b7280 0%, #9ca3af 100%)",
    borderRadius: 999,
    transition: "width 0.25s ease",
  },
  card: {
    background: "rgba(255, 255, 255, 0.96)",
    border: "1px solid #e5e7eb",
    borderRadius: 24,
    boxShadow: "0 18px 45px rgba(17, 24, 39, 0.08)",
    padding: 28,
  } as const,
  title: {
  fontSize: "3rem",
  fontWeight: 800,
  letterSpacing: "-1px",
  color: "#111827",
  margin: "0 0 14px",
  textAlign: "center" as const,
},
  subtitle: {
  fontSize: "1rem",
  color: "#6b7280",
  margin: "0 0 28px",
  textAlign: "center" as const,
},
  primaryButton: {
    background: "#111827",
    color: "#ffffff",
    border: "none",
    borderRadius: 14,
    padding: "14px 20px",
    fontSize: "1rem",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(17, 24, 39, 0.16)",
  } as const,
  secondaryButton: {
    background: "#ffffff",
    color: "#111827",
    border: "1px solid #d1d5db",
    borderRadius: 14,
    padding: "13px 18px",
    fontSize: "1rem",
    fontWeight: 600,
    cursor: "pointer",
  } as const,
  disabledButton: {
    opacity: 0.45,
    cursor: "not-allowed",
  } as const,
  heroButtonWrap: {
    display: "flex",
    justifyContent: "center",
    padding: "10px 0 2px",
  },
  optionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 14,
    marginBottom: 20,
  } as const,
  optionCard: {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 18,
  cursor: "pointer",
  textAlign: "left" as const,
  transition: "all 0.2s ease",
},
  selectedCard: {
  border: "2px solid #2563eb",
  background: "#eff6ff",
  boxShadow: "0 0 0 2px rgba(37, 99, 235, 0.1)",
},
  optionTitle: {
  fontWeight: 700,
  fontSize: "1.05rem",
  marginBottom: 8,
  color: "#111827",
},
  optionMeta: {
  color: "#6b7280",
  fontSize: "0.95rem",
  lineHeight: 1.45,
},
  estimateBox: {
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 16,
    textAlign: "center" as const,
    marginTop: 6,
  } as const,
  estimateLabel: {
    color: "#6b7280",
    fontSize: "0.95rem",
    marginBottom: 6,
  },
  estimateValue: {
    fontSize: "1.05rem",
    fontWeight: 800,
    color: "#111827",
    lineHeight: 1.5,
  },
  noteBox: {
    marginTop: 14,
    background: "#f3f4f6",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 14,
    color: "#374151",
    textAlign: "center" as const,
    lineHeight: 1.45,
  } as const,
  addOnGrid: {
    display: "grid",
    gap: 12,
    marginBottom: 18,
  } as const,
  addOnRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 16,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    cursor: "pointer",
    justifyContent: "space-between",
    flexWrap: "wrap" as const,
  },
  checkWrap: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flex: 1,
    minWidth: 220,
  },
  checkbox: {
    width: 18,
    height: 18,
    accentColor: "#111827",
  },
  addOnPrice: {
    color: "#374151",
    fontWeight: 700,
  },
  inputGrid: {
    display: "grid",
    gap: 14,
    maxWidth: 560,
    margin: "0 auto",
  } as const,
  input: {
    width: "100%",
    boxSizing: "border-box" as const,
    background: "#ffffff",
    color: "#111827",
    border: "1px solid #d1d5db",
    borderRadius: 14,
    padding: "14px 16px",
    fontSize: "1rem",
    outline: "none",
  },
  buttonRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap" as const,
    marginTop: 24,
  },
  rightButtons: {
    display: "flex",
    gap: 12,
    marginLeft: "auto",
  } as const,
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 14,
    marginTop: 22,
  } as const,
  summaryCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 16,
  },
  sectionLabel: {
  fontSize: "0.95rem",
  fontWeight: 700,
  color: "#374151",
  marginTop: 6,
  marginBottom: -4,
  textAlign: "left" as const,
},

vehicleRow: {
  display: "flex",
  gap: 10,
  alignItems: "center",
} as const,
  summaryHeading: {
    fontSize: "0.92rem",
    color: "#6b7280",
    marginBottom: 8,
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
  },
  summaryValue: {
    fontSize: "1rem",
    fontWeight: 700,
    lineHeight: 1.5,
    color: "#111827",
    wordBreak: "break-word" as const,
  },
  submittedWrap: {
    textAlign: "center" as const,
    padding: "10px 0",
  },
  successBadge: {
    fontSize: "3rem",
    marginBottom: 6,
  },
  successText: {
    fontSize: "1.05rem",
    color: "#4b5563",
    lineHeight: 1.6,
    maxWidth: 620,
    margin: "0 auto 24px",
  },
};

  return (
    <div style={styles.page}>
      <div style={styles.container}>
<div style={styles.brand}>
  <div style={styles.brandRow}>
    <img src={logo} alt="ATX Prestige Detailing logo" style={styles.logo} />
    <div>
      <h1 style={styles.brandTitle}>ATX Prestige Detailing</h1>
      <p style={styles.brandSub}>
        Private build version — refining the experience before launch
      </p>
    </div>
  </div>
</div>

        <div style={styles.progressWrap}>
          <div style={styles.progressText}>
            <span>Booking Flow</span>
            <span>Step {step + 1} of 8</span>
          </div>
          <div style={styles.progressBar}>
            <div style={styles.progressFill} />
          </div>
        </div>

        <div style={styles.card}>
          {step === 0 && (
            <>
              <h2 style={styles.title}>Book a Detail Service</h2>
              <p style={styles.subtitle}>
                Simple guided booking flow for mobile detailing, package selection,
                add-ons, and appointment requests.
              </p>
              <div style={styles.heroButtonWrap}>
                <button style={styles.primaryButton} onClick={next}>
                  Book Detail Service
                </button>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h2 style={styles.title}>Choose a Vehicle Type</h2>
              <p style={styles.subtitle}>Select the vehicle class to continue.</p>

              <div style={styles.optionGrid}>
                {vehicleOptions.map((option) => {
                  const isSelected = vehicle === option.id;
                  return (
                    <button
                      key={option.id}
                      style={{
                        ...styles.optionCard,
                        ...(isSelected ? styles.selectedCard : {}),
                      }}
                      onClick={() => {
                        setVehicle(option.id);
                        setPkg("");
                      }}
                    >
                      <div style={styles.optionTitle}>{option.label}</div>
                      <div style={styles.optionMeta}>
                        Basic {formatCurrency(option.basicRate)}/hr
                        <br />
                        Premium {formatCurrency(option.premiumRate)}/hr
                      </div>
                    </button>
                  );
                })}
              </div>

              <div style={styles.buttonRow}>
                <div />
                <div style={styles.rightButtons}>
                  <button
                    style={{
                      ...styles.primaryButton,
                      ...(!vehicle ? styles.disabledButton : {}),
                    }}
                    onClick={next}
                    disabled={!vehicle}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 style={styles.title}>Choose a Detail Package</h2>
              <p style={styles.subtitle}>Pick the service level that fits the vehicle.</p>

              <div style={styles.optionGrid}>
                {(["basic", "premium"] as PackageType[]).map((packageType) => {
                  const isSelected = pkg === packageType;
                  const label = packageType === "basic" ? "Basic Detail" : "Premium Detail";
                  const rateText = selectedVehicle
                    ? `${formatCurrency(
                        packageType === "basic"
                          ? selectedVehicle.basicRate
                          : selectedVehicle.premiumRate
                      )}/hr`
                    : "Select vehicle first";
                  const timeText = !vehicle
                    ? "Average time shown after vehicle selection"
                    : packageType === "premium"
                    ? "3–5 hours avg"
                    : vehicle === "truckSuv"
                    ? "3–5 hours avg"
                    : "3–4 hours avg";

                  return (
                    <button
                      key={packageType}
                      style={{
                        ...styles.optionCard,
                        ...(isSelected ? styles.selectedCard : {}),
                      }}
                      onClick={() => setPkg(packageType)}
                    >
                      <div style={styles.optionTitle}>{label}</div>
                      <div style={styles.optionMeta}>
                        {rateText}
                        <br />
                        {timeText}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div style={styles.estimateBox}>
                <div style={styles.estimateLabel}>Estimate</div>
                <div style={styles.estimateValue}>{estimateText || "$ per hour"}</div>
              </div>

              <div style={styles.noteBox}>
                If wanting to see what’s included in basic/premium packages go to
                <br />
                <strong>atxprestigedetailing.com</strong>
              </div>

              <div style={styles.buttonRow}>
                <button style={styles.secondaryButton} onClick={back}>
                  Back
                </button>
                <div style={styles.rightButtons}>
                  <button
                    style={{
                      ...styles.primaryButton,
                      ...(!pkg ? styles.disabledButton : {}),
                    }}
                    onClick={next}
                    disabled={!pkg}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 style={styles.title}>Choose Add-Ons</h2>
              <p style={styles.subtitle}>Optional upgrades for the appointment.</p>

              <div style={styles.addOnGrid}>
                {addOnOptions.map((option) => (
                  <label key={option.label} style={styles.addOnRow}>
                    <div style={styles.checkWrap}>
                      <input
                        style={styles.checkbox}
                        type="checkbox"
                        checked={addOns.includes(option.label)}
                        onChange={() => toggleAddOn(option.label)}
                      />
                      <span>{option.label}</span>
                    </div>
                    <span style={styles.addOnPrice}>{option.priceText}</span>
                  </label>
                ))}
              </div>

              <div style={styles.estimateBox}>
                <div style={styles.estimateLabel}>Estimate</div>
                <div style={styles.estimateValue}>
                  {estimateText || "$ per hour"}
                  {addOnSummaryText ? ` + ${addOnSummaryText}` : ""}
                </div>
              </div>

              <div style={styles.buttonRow}>
                <button style={styles.secondaryButton} onClick={back}>
                  Back
                </button>
                <div style={styles.rightButtons}>
                  <button style={styles.primaryButton} onClick={next}>
                    Next
                  </button>
                </div>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h2 style={styles.title}>Mobile or Drop-Off Service</h2>
              <p style={styles.subtitle}>Choose where the service will happen.</p>

              <div style={styles.optionGrid}>
                <button
                  style={{
                    ...styles.optionCard,
                    ...(serviceType === "mobile" ? styles.selectedCard : {}),
                  }}
                  onClick={() => setServiceType("mobile")}
                >
                  <div style={styles.optionTitle}>Mobile Service</div>
                  <div style={styles.optionMeta}>
                    Customer enters a service address for on-site detail service.
                  </div>
                </button>

                <button
                  style={{
                    ...styles.optionCard,
                    ...(serviceType === "dropoff" ? styles.selectedCard : {}),
                  }}
                  onClick={() => {
                    setServiceType("dropoff");
                    setAddress("");
                  }}
                >
                  <div style={styles.optionTitle}>Drop-Off Service</div>
                  <div style={styles.optionMeta}>
                    Someone will contact the client with drop-off details.
                  </div>
                </button>
              </div>

              {serviceType === "mobile" && (
                <div style={{ marginTop: 18 }}>
                  <input
                    style={styles.input}
                    placeholder="Enter service address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
              )}

              <div style={styles.buttonRow}>
                <button style={styles.secondaryButton} onClick={back}>
                  Back
                </button>
                <div style={styles.rightButtons}>
                  <button
                    style={{
                      ...styles.primaryButton,
                      ...((!serviceType || (serviceType === "mobile" && !address.trim()))
                        ? styles.disabledButton
                        : {}),
                    }}
                    onClick={next}
                    disabled={!serviceType || (serviceType === "mobile" && !address.trim())}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}

          {step === 5 && (
            <>
              <h2 style={styles.title}>Customer Information</h2>
              <p style={styles.subtitle}>
                Capture contact details for appointment confirmation.
              </p>

              <div style={styles.inputGrid}>
  <div style={{ marginTop: 20 }}>
    <div style={styles.sectionLabel}>Select Appointment Date</div>

  <select
    style={{
      ...styles.input,
      backgroundColor: "#ffffff",
      color: "#111827",
      cursor: "pointer",
    }}
    value={selectedDate}
    onChange={(e) => {
      setSelectedDate(e.target.value);
      setSelectedTime("");
    }}
  >
    <option value="">Select a date</option>

    {availableDates.map((date, index) => (
      <option key={index} value={date}>
        {date}
      </option>
    ))}
  </select>
</div>

<div style={{ marginTop: 20 }}>
  <div style={styles.sectionLabel}>Available Time</div>

 <select
  style={{
    ...styles.input,
    backgroundColor: "#ffffff",
    color: "#111827",
    cursor: "pointer",
  }}
  value={selectedTime}
  onChange={(e) => setSelectedTime(e.target.value)}
  disabled={false}
>
  <option value="">Select a time</option>

  {availableSlots.map((slot, index) => (
    <option key={index} value={slot.time}>
      {slot.time}
    </option>
  ))}
</select>
<div style={{ marginTop: 8, fontSize: "0.95rem", color: "#111827" }}>
  {availableSlots.map((slot, index) => (
    <div key={index}>{slot.time}</div>
  ))}
</div>
  {selectedDate && availableSlots.length === 0 && (
  <div style={{ marginTop: 8, color: "#b91c1c", fontSize: "0.95rem" }}>
    No available times found for this date.
  </div>
)}
</div>
                <input
                  style={styles.input}
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <input
                  style={styles.input}
                  placeholder="Phone number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <input
                  style={styles.input}
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div> <div style={{ display: "flex", gap: 8 }}>
                
  </div>

<div style={{ marginTop: 24 }}>
  <div style={styles.sectionLabel}>Vehicle Information</div>

  <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
    <input
      style={{ ...styles.input, flex: 1 }}
      placeholder="Year"
      value={year}
      onChange={(e) => setYear(e.target.value)}
    />

    <input
      style={{ ...styles.input, flex: 2 }}
      placeholder="Make"
      value={make}
      onChange={(e) => setMake(e.target.value)}
    />

    <input
      style={{ ...styles.input, flex: 2 }}
      placeholder="Model"
      value={model}
      onChange={(e) => setModel(e.target.value)}
    />
  </div>
</div>

              <div style={styles.buttonRow}>
                <button style={styles.secondaryButton} onClick={back}>
                  Back
                </button>
                <div style={styles.rightButtons}>
                  <button
                    style={{
                      ...styles.primaryButton,
                     ...(
  (!name ||
    !phone ||
    !email ||
    !year ||
    !make ||
    !model ||
    !selectedDate ||
    !selectedTime)
    ? styles.disabledButton
    : {}
),
                    }}
                    onClick={next}
                    disabled={
  !name ||
  !phone ||
  !email ||
  !year ||
  !make ||
  !model ||
  !selectedDate ||
  !selectedTime
}
                  >
                    Review Booking
                  </button>
                </div>
              </div>
            </>
          )}

          {step === 6 && (
            <>
              <h2 style={styles.title}>Review Booking</h2>
              <p style={styles.subtitle}>Review the request details before submitting.</p>

              <div style={styles.summaryGrid}>
                <div style={styles.summaryCard}>
                  <div style={styles.summaryHeading}>Customer</div>
                  <div style={styles.summaryValue}>
                    {name}
                    <br />
                    {phone}
                    <br />
                    {email}
                  </div>
                </div>
                <div style={styles.summaryCard}>
  <div style={styles.summaryHeading}>Appointment</div>
  <div style={styles.summaryValue}>
    {selectedDate || "N/A"}
    <br />
    {selectedTime || "N/A"}
  </div>
</div>

                <div style={styles.summaryCard}>
                  <div style={styles.summaryHeading}>Service</div>
                  <div style={styles.summaryValue}>
                    {selectedVehicle?.label || "N/A"}
                    <br />
                    {pkg === "basic" ? "Basic Detail" : pkg === "premium" ? "Premium Detail" : "N/A"}
                    <br />
                    {estimateText || "N/A"}
                  </div>
                </div>

                <div style={styles.summaryCard}>
  <div style={styles.summaryHeading}>Appointment Type</div>
  <div style={styles.summaryValue}>
    {serviceType === "mobile" ? "Mobile Service" : serviceType === "dropoff" ? "Drop-Off Service" : "N/A"}
    <br />
    {address || "No address provided"}
  </div>
</div>
                <div style={styles.summaryCard}>
  <div style={styles.summaryHeading}>Vehicle</div>
  <div style={styles.summaryValue}>
    {year || "N/A"} {make || ""} {model || ""}
    <br />
    {selectedVehicle?.label || "N/A"}
  </div>
</div>

                <div style={styles.summaryCard}>
                  <div style={styles.summaryHeading}>Add-Ons</div>
                  <div style={styles.summaryValue}>
                    {addOns.length ? addOns.join(", ") : "No add-ons selected"}
                  </div>
                </div>

                <div style={styles.summaryCard}>
                  <div style={styles.summaryHeading}>Appointment Type</div>
                  <div style={styles.summaryValue}>
                    {serviceType === "mobile"
                      ? `Mobile Service${address ? ` — ${address}` : ""}`
                      : serviceType === "dropoff"
                      ? "Drop-Off Service"
                      : "N/A"}
                  </div>
                </div>

                <div style={styles.summaryCard}>
                  <div style={styles.summaryHeading}>Estimated Add-Ons</div>
                  <div style={styles.summaryValue}>{formatCurrency(addOnEstimate)}</div>
                </div>

                <div style={styles.summaryCard}>
                  <div style={styles.summaryHeading}>Avg Package Time</div>
                  <div style={styles.summaryValue}>{packageHours}</div>
                </div>
              </div>

              <div style={styles.buttonRow}>
                <button style={styles.secondaryButton} onClick={back}>
                  Back
                </button>
                <div style={styles.rightButtons}>
                  <button
  style={styles.primaryButton}
  onClick={async () => {
    try {
 const res = await fetch(SCRIPT_URL, {
  method: "POST",
  body: JSON.stringify({
    action: "bookAppointment",
    name,
    phone,
    email,
    date: selectedDate,
    time: selectedTime,
    year,
    make,
    model,
    vehicle,
    packageType: pkg,
    hourlyRate,
    addOns: addOns.join(", "),
    addOnEstimate,
    serviceType,
    address,
    avgTime: packageHours,
  }),
});

const data = await res.json();


      if (data.success) {
        alert("Booking submitted successfully!");
        next();
      } else {
        alert("Something went wrong.");
        console.error(data);
      }
    } catch (err) {
      console.error(err);
      alert("Error submitting booking.");
    }
  }}
>
  Submit Booking
</button>
                </div>
              </div>
            </>
          )}

          {step === 7 && (
            <>
              <div style={styles.submittedWrap}>
                <div style={styles.successBadge}>✅</div>
                <h2 style={styles.title}>Booking Request Submitted</h2>
                <p style={styles.successText}>
                  Someone will be reaching out to you to confirm your service.
                  This private build is also showing a booking summary for testing.
                </p>
              </div>

              <div style={styles.summaryGrid}>
                <div style={styles.summaryCard}>
                  <div style={styles.summaryHeading}>Customer</div>
                  <div style={styles.summaryValue}>
                    {name}
                    <br />
                    {phone}
                    <br />
                    {email}
                  </div>
                </div>
                <div style={styles.summaryCard}>
  <div style={styles.summaryHeading}>Appointment</div>
  <div style={styles.summaryValue}>
    {selectedDate || "N/A"}
    <br />
    {selectedTime || "N/A"}
  </div>
</div>

                <div style={styles.summaryCard}>
                  <div style={styles.summaryHeading}>Service</div>
                  <div style={styles.summaryValue}>
                    {selectedVehicle?.label || "N/A"}
                    <br />
                    {pkg === "basic" ? "Basic Detail" : pkg === "premium" ? "Premium Detail" : "N/A"}
                    <br />
                    {estimateText || "N/A"}
                  </div>
                </div>
                <div style={styles.summaryCard}>

                  <div style={styles.summaryCard}>
  <div style={styles.summaryHeading}>Appointment Type</div>
  <div style={styles.summaryValue}>
    {serviceType === "mobile" ? "Mobile Service" : serviceType === "dropoff" ? "Drop-Off Service" : "N/A"}
    <br />
    {address || "No address provided"}
  </div>
</div>
  <div style={styles.summaryHeading}>Vehicle</div>
  <div style={styles.summaryValue}>
    {year || "N/A"} {make || ""} {model || ""}
    <br />
    {selectedVehicle?.label || "N/A"}
  </div>
</div>

                <div style={styles.summaryCard}>
                  <div style={styles.summaryHeading}>Add-Ons</div>
                  <div style={styles.summaryValue}>
                    {addOns.length ? addOns.join(", ") : "No add-ons selected"}
                  </div>
                </div>

                <div style={styles.summaryCard}>
                  <div style={styles.summaryHeading}>Appointment Type</div>
                  <div style={styles.summaryValue}>
                    {serviceType === "mobile"
                      ? `Mobile Service${address ? ` — ${address}` : ""}`
                      : serviceType === "dropoff"
                      ? "Drop-Off Service"
                      : "N/A"}
                  </div>
                </div>

                <div style={styles.summaryCard}>
                  <div style={styles.summaryHeading}>Estimated Add-Ons</div>
                  <div style={styles.summaryValue}>{formatCurrency(addOnEstimate)}</div>
                </div>

                <div style={styles.summaryCard}>
                  <div style={styles.summaryHeading}>Avg Package Time</div>
                  <div style={styles.summaryValue}>{packageHours}</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}