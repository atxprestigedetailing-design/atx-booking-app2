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
    <div style={{ padding: 20, maxWidth: 500, margin: "auto" }}>
      {step === 0 && (
        <div>
          <h1>ATX Prestige Detailing</h1>
          <button onClick={next}>Book Detail Service</button>
        </div>
      )}

      {step === 1 && (
        <div>
          <h2>Select Vehicle</h2>
          <button onClick={() => setVehicle("truck")}>Truck / SUV</button>
          <button onClick={() => setVehicle("sedan")}>Sedan</button>
          <button onClick={() => setVehicle("coupe")}>Coupe</button>

          <p>Estimate: ${vehicle ? "per hour" : ""}</p>

          <button onClick={next} disabled={!vehicle}>
            Next
          </button>
        </div>
      )}

      {step === 2 && (
        <div>
          <h2>Select Package</h2>
          <button onClick={() => setPkg("basic")}>Basic</button>
          <button onClick={() => setPkg("premium")}>Premium</button>

          <p>Rate: ${getRate()}/hr</p>

          <p>
            If wanting to see what’s included go to
            atxprestigedetailing.com
          </p>

          <button onClick={back}>Back</button>
          <button onClick={next} disabled={!pkg}>
            Next
          </button>
        </div>
      )}

      {step === 3 && (
        <div>
          <h2>Add-ons</h2>

          <label>
            <input
              type="checkbox"
              onChange={() => toggleAddon("Headlight")}
            />
            Headlight Restoration ($150)
          </label>

          <label>
            <input
              type="checkbox"
              onChange={() => toggleAddon("Pet Hair")}
            />
            Pet Hair Removal ($60)
          </label>

          <label>
            <input
              type="checkbox"
              onChange={() => toggleAddon("Steam")}
            />
            Steam Cleaning ($60)
          </label>

          <p>Estimate: ${getRate()}/hr</p>

          <button onClick={back}>Back</button>
          <button onClick={next}>Next</button>
        </div>
      )}

      {step === 4 && (
        <div>
          <h2>Service Type</h2>
          <button onClick={() => setServiceType("mobile")}>
            Mobile
          </button>
          <button onClick={() => setServiceType("dropoff")}>
            Drop Off
          </button>

          {serviceType === "mobile" && (
            <input
              placeholder="Enter address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          )}

          <button onClick={back}>Back</button>
          <button onClick={next} disabled={!serviceType}>
            Next
          </button>
        </div>
      )}

      {step === 5 && (
        <div>
          <h2>Your Info</h2>
          <input
            placeholder="Name"
            onChange={(e) => setName(e.target.value)}
          />
          <input
            placeholder="Phone"
            onChange={(e) => setPhone(e.target.value)}
          />
          <input
            placeholder="Email"
            onChange={(e) => setEmail(e.target.value)}
          />

          <button onClick={back}>Back</button>
          <button onClick={next}>Next</button>
        </div>
      )}

      {step === 6 && (
        <div>
          <h2>Submitted ✅</h2>
          <p>Someone will be reaching out to confirm your service.</p>
        </div>
      )}
    </div>
  );
}