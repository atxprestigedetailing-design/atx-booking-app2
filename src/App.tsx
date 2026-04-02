import { useState } from "react";

type VehicleType = "truck" | "sedan" | "coupe" | "";
type PackageType = "basic" | "premium" | "";

export default function App() {
  const [step, setStep] = useState(0);
  const [vehicle, setVehicle] = useState<VehicleType>("");
  const [pkg, setPkg] = useState<PackageType>("");
  const [addOns, setAddOns] = useState<string[]>([]);
  const [serviceType, setServiceType] = useState("");
  const [address, setAddress] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const getRate = () => {
    if (vehicle === "coupe") return pkg === "premium" ? 85 : 65;
    if (vehicle === "sedan") return pkg === "premium" ? 90 : 70;
    if (vehicle === "truck") return pkg === "premium" ? 100 : 80;
    return 0;
  };

  const toggleAddon = (addon: string) => {
    setAddOns((prev) =>
      prev.includes(addon)
        ? prev.filter((a) => a !== addon)
        : [...prev, addon]
    );
  };

  const next = () => setStep((s) => s + 1);
  const back = () => setStep((s) => s - 1);

  return (
    <div
      style={{
        padding: 20,
        maxWidth: 700,
        margin: "0 auto",
        textAlign: "center",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {step === 0 && (
        <div>
          <h1>ATX Prestige Detailing</h1>
          <button onClick={next}>Book Detail Service</button>
        </div>
      )}

      {step === 1 && (
        <div>
          <h2>Select Vehicle</h2>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16 }}>
            <button onClick={() => setVehicle("truck")}>Truck / SUV</button>
            <button onClick={() => setVehicle("sedan")}>Sedan</button>
            <button onClick={() => setVehicle("coupe")}>Coupe</button>
          </div>

          <p>
            Estimate:{" "}
            {vehicle === "truck"
              ? "Basic $80/hr · Premium $100/hr"
              : vehicle === "sedan"
              ? "Basic $70/hr · Premium $90/hr"
              : vehicle === "coupe"
              ? "Basic $65/hr · Premium $85/hr"
              : "$ per hour"}
          </p>

          <button onClick={next} disabled={!vehicle}>
            Next
          </button>
        </div>
      )}

      {step === 2 && (
        <div>
          <h2>Select Package</h2>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16 }}>
            <button onClick={() => setPkg("basic")}>Basic</button>
            <button onClick={() => setPkg("premium")}>Premium</button>
          </div>

          <p>Rate: {getRate() ? `$${getRate()}/hr` : "$0/hr"}</p>

          <p>
            Avg Time:{" "}
            {vehicle === "truck"
              ? "3-5 hours"
              : vehicle === "sedan"
              ? "3-4 hours"
              : vehicle === "coupe" && pkg === "premium"
              ? "3-5 hours"
              : vehicle === "coupe"
              ? "3-4 hours"
              : ""}
          </p>

          <p>If wanting to see what’s included go to atxprestigedetailing.com</p>

          <button onClick={back}>Back</button>{" "}
          <button onClick={next} disabled={!pkg}>
            Next
          </button>
        </div>
      )}

      {step === 3 && (
        <div>
          <h2>Add-ons</h2>

          <div style={{ display: "grid", gap: 10, justifyContent: "center", marginBottom: 16 }}>
            <label>
              <input
                type="checkbox"
                checked={addOns.includes("Headlight Restoration")}
                onChange={() => toggleAddon("Headlight Restoration")}
              />{" "}
              Headlight Restoration ($150)
            </label>

            <label>
              <input
                type="checkbox"
                checked={addOns.includes("Stain Removal")}
                onChange={() => toggleAddon("Stain Removal")}
              />{" "}
              Stain Removal (Need consultation)
            </label>

            <label>
              <input
                type="checkbox"
                checked={addOns.includes("Paint Correction")}
                onChange={() => toggleAddon("Paint Correction")}
              />{" "}
              Paint Correction (Need consultation)
            </label>

            <label>
              <input
                type="checkbox"
                checked={addOns.includes("Pet Hair Removal")}
                onChange={() => toggleAddon("Pet Hair Removal")}
              />{" "}
              Pet Hair Removal ($60)
            </label>

            <label>
              <input
                type="checkbox"
                checked={addOns.includes("Steam Cleaning")}
                onChange={() => toggleAddon("Steam Cleaning")}
              />{" "}
              Steam Cleaning ($60)
            </label>

            <label>
              <input
                type="checkbox"
                checked={addOns.includes("Ceramic Coating")}
                onChange={() => toggleAddon("Ceramic Coating")}
              />{" "}
              Ceramic Coating (Need consultation)
            </label>
          </div>

          <p>Estimate: {getRate() ? `$${getRate()}/hr` : "$0/hr"}</p>

          <button onClick={back}>Back</button>{" "}
          <button onClick={next}>Next</button>
        </div>
      )}

      {step === 4 && (
        <div>
          <h2>Service Type</h2>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16 }}>
            <button onClick={() => setServiceType("mobile")}>Mobile</button>
            <button onClick={() => setServiceType("dropoff")}>Drop Off</button>
          </div>

          {serviceType === "mobile" && (
            <div style={{ marginBottom: 16 }}>
              <input
                placeholder="Enter address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                style={{ width: 300 }}
              />
            </div>
          )}

          {serviceType === "dropoff" && <p>Someone will contact client with drop-off details.</p>}

          <button onClick={back}>Back</button>{" "}
          <button
            onClick={next}
            disabled={!serviceType || (serviceType === "mobile" && !address.trim())}
          >
            Next
          </button>
        </div>
      )}

      {step === 5 && (
        <div>
          <h2>Your Info</h2>
          <div style={{ display: "grid", gap: 10, maxWidth: 350, margin: "0 auto 16px" }}>
            <input
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              placeholder="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <input
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <button onClick={back}>Back</button>{" "}
          <button onClick={next} disabled={!name || !phone || !email}>
            Next
          </button>
        </div>
      )}

      {step === 6 && (
        <div>
          <h2>Submitted ✅</h2>
          <p>Someone will be reaching out to confirm your service.</p>

          <div style={{ marginTop: 20, textAlign: "left", maxWidth: 420, marginInline: "auto" }}>
            <p><strong>Name:</strong> {name}</p>
            <p><strong>Phone:</strong> {phone}</p>
            <p><strong>Email:</strong> {email}</p>
            <p><strong>Vehicle:</strong> {vehicle || "N/A"}</p>
            <p><strong>Package:</strong> {pkg || "N/A"}</p>
            <p><strong>Rate:</strong> {getRate() ? `$${getRate()}/hr` : "N/A"}</p>
            <p><strong>Service Type:</strong> {serviceType || "N/A"}</p>
            {serviceType === "mobile" && <p><strong>Address:</strong> {address}</p>}
            <p><strong>Add-ons:</strong> {addOns.length ? addOns.join(", ") : "None"}</p>
          </div>
        </div>
      )}
    </div>
  );
}