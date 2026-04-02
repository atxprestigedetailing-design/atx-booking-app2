import { useMemo, useState } from "react";

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

  const selectedVehicle = vehicleOptions.find((v) => v.id === vehicle);

  const hourlyRate = useMemo(() => {
    if (!selectedVehicle || !pkg) return 0;
    return pkg === "basic" ? selectedVehicle.basicRate : selectedVehicle.premiumRate;
  }, [selectedVehicle, pkg]);

  const packageHours = useMemo(() => {
    if (!vehicle || !pkg) return "Select vehicle first";
    if (vehicle === "truckSuv") return "3–5 hours avg";
    if (vehicle === "sedan") return "3–4 hours avg";
    if (vehicle === "coupe" && pkg === "premium") return "3–5 hours avg";
    return "3–4 hours avg";
  }, [vehicle, pkg]);

  const addOnEstimate = useMemo(() => {
    return addOns.reduce((sum, selected) => {
      const found = addOnOptions.find((option) => option.label === selected);
      return sum + (found?.fixedPrice ?? 0);
    }, 0);
  }, [addOns]);

  const estimateText = useMemo(() => {
    if (hourlyRate) return `${formatCurrency(hourlyRate)}/hr`;
    if (selectedVehicle) {
      return `Basic ${formatCurrency(selectedVehicle.basicRate)}/hr · Premium ${formatCurrency(
        selectedVehicle.premiumRate
      )}/hr`;
    }
    return "$ per hour";
  }, [hourlyRate, selectedVehicle]);

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
      background:
        "radial-gradient(circle at top, #2b2b2b 0%, #141414 35%, #0b0b0b 100%)",
      color: "#f5f5f5",
      padding: "32px 16px",
      fontFamily:
        'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    } as const,
    container: {
      maxWidth: 920,
      margin: "0 auto",
    } as const,
    brand: {
      textAlign: "center" as const,
      marginBottom: 24,
    },
    brandTitle: {
      fontSize: "clamp(2rem, 5vw, 3.25rem)",
      fontWeight: 800,
      margin: 0,
      letterSpacing: "-0.03em",
    },
    brandSub: {
      color: "#b6b6b6",
      fontSize: "0.98rem",
      marginTop: 10,
      marginBottom: 0,
    },
    progressWrap: {
      marginBottom: 20,
    },
    progressText: {
      display: "flex",
      justifyContent: "space-between",
      color: "#a8a8a8",
      fontSize: "0.9rem",
      marginBottom: 8,
    },
    progressBar: {
      height: 8,
      background: "#222",
      borderRadius: 999,
      overflow: "hidden",
      border: "1px solid #2e2e2e",
    } as const,
    progressFill: {
      height: "100%",
      width: `${((step + 1) / 7) * 100}%`,
      background: "linear-gradient(90deg, #d4af37 0%, #f1d98d 100%)",
      borderRadius: 999,
      transition: "width 0.25s ease",
    },
    card: {
      background: "rgba(20, 20, 20, 0.92)",
      border: "1px solid #2f2f2f",
      borderRadius: 24,
      boxShadow: "0 16px 50px rgba(0,0,0,0.35)",
      padding: 28,
    } as const,
    title: {
      fontSize: "clamp(1.75rem, 4vw, 2.35rem)",
      fontWeight: 800,
      marginTop: 0,
      marginBottom: 8,
      textAlign: "center" as const,
    },
    subtitle: {
      color: "#b4b4b4",
      textAlign: "center" as const,
      marginTop: 0,
      marginBottom: 24,
      lineHeight: 1.5,
    },
    primaryButton: {
      background: "linear-gradient(135deg, #d4af37 0%, #b9931b 100%)",
      color: "#111",
      border: "none",
      borderRadius: 14,
      padding: "14px 20px",
      fontSize: "1rem",
      fontWeight: 700,
      cursor: "pointer",
      boxShadow: "0 10px 24px rgba(212, 175, 55, 0.22)",
    } as const,
    secondaryButton: {
      background: "#1a1a1a",
      color: "#f5f5f5",
      border: "1px solid #363636",
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
      background: "#111",
      border: "1px solid #2f2f2f",
      borderRadius: 18,
      padding: 18,
      cursor: "pointer",
      textAlign: "left" as const,
      transition: "all 0.2s ease",
    } as const,
    selectedCard: {
      border: "1px solid #d4af37",
      background: "linear-gradient(180deg, rgba(212,175,55,0.12), rgba(17,17,17,1))",
      boxShadow: "0 0 0 1px rgba(212,175,55,0.18) inset",
    } as const,
    optionTitle: {
      fontWeight: 700,
      fontSize: "1.05rem",
      marginBottom: 8,
    },
    optionMeta: {
      color: "#b9b9b9",
      fontSize: "0.95rem",
      lineHeight: 1.45,
    },
    estimateBox: {
      background: "#101010",
      border: "1px solid #2c2c2c",
      borderRadius: 16,
      padding: 16,
      textAlign: "center" as const,
      marginTop: 6,
    } as const,
    estimateLabel: {
      color: "#9d9d9d",
      fontSize: "0.95rem",
      marginBottom: 6,
    },
    estimateValue: {
      fontSize: "1.2rem",
      fontWeight: 800,
      color: "#f5f5f5",
    },
    noteBox: {
      marginTop: 14,
      background: "rgba(212,175,55,0.08)",
      border: "1px solid rgba(212,175,55,0.18)",
      borderRadius: 16,
      padding: 14,
      color: "#dfdfdf",
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
      border: "1px solid #2d2d2d",
      background: "#111",
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
      accentColor: "#d4af37",
    },
    addOnPrice: {
      color: "#d8d8d8",
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
      background: "#101010",
      color: "#f4f4f4",
      border: "1px solid #333",
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
      background: "#101010",
      border: "1px solid #2d2d2d",
      borderRadius: 16,
      padding: 16,
    },
    summaryHeading: {
      fontSize: "0.92rem",
      color: "#a9a9a9",
      marginBottom: 8,
      textTransform: "uppercase" as const,
      letterSpacing: "0.04em",
    },
    summaryValue: {
      fontSize: "1rem",
      fontWeight: 700,
      lineHeight: 1.5,
      color: "#f5f5f5",
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
      color: "#c9c9c9",
      lineHeight: 1.6,
      maxWidth: 620,
      margin: "0 auto 24px",
    },
  };

  const totalSteps = 7;

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.brand}>
          <h1 style={styles.brandTitle}>ATX Prestige Detailing</h1>
          <p style={styles.brandSub}>
            Private build version — refining the experience before launch
          </p>
        </div>

        <div style={styles.progressWrap}>
          <div style={styles.progressText}>
            <span>Booking Flow</span>
            <span>
              Step {step + 1} of {totalSteps}
            </span>
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

              <div style={styles.estimateBox}>
                <div style={styles.estimateLabel}>Estimate</div>
                <div style={styles.estimateValue}>{estimateText}</div>
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
                        {hourlyRate && pkg === packageType
                          ? `${formatCurrency(hourlyRate)}/hr`
                          : selectedVehicle
                          ? `${formatCurrency(
                              packageType === "basic"
                                ? selectedVehicle.basicRate
                                : selectedVehicle.premiumRate
                            )}/hr`
                          : "Select vehicle first"}
                        <br />
                        {vehicle
                          ? packageType === "premium"
                            ? vehicle === "sedan"
                              ? "3–5 hours avg"
                              : "3–5 hours avg"
                            : vehicle === "truckSuv"
                            ? "3–5 hours avg"
                            : "3–4 hours avg"
                          : "Average time shown after vehicle selection"}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div style={styles.estimateBox}>
                <div style={styles.estimateLabel}>Estimate</div>
                <div style={styles.estimateValue}>{estimateText}</div>
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
                <div style={styles.estimateValue}>{estimateText}</div>
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
              </div>

              <div style={styles.buttonRow}>
                <button style={styles.secondaryButton} onClick={back}>
                  Back
                </button>
                <div style={styles.rightButtons}>
                  <button
                    style={{
                      ...styles.primaryButton,
                      ...((!name || !phone || !email) ? styles.disabledButton : {}),
                    }}
                    onClick={next}
                    disabled={!name || !phone || !email}
                  >
                    Review Request
                  </button>
                </div>
              </div>
            </>
          )}

          {step === 6 && (
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
                  <div style={styles.summaryHeading}>Service</div>
                  <div style={styles.summaryValue}>
                    {selectedVehicle?.label || "N/A"}
                    <br />
                    {pkg === "basic" ? "Basic Detail" : pkg === "premium" ? "Premium Detail" : "N/A"}
                    <br />
                    {estimateText}
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