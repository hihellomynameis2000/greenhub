"use client";

import Image from "next/image";
import React, { useMemo, useState } from "react";

type ClassValue = string | false | null | undefined;

type Step = {
  key: string;
  label: string;
};

type FormData = {
  dbaName: string;
  legalName: string;
  corpStructure: string;
  industry: string;
  websiteUrl: string;
  websiteLogin: string;
  websitePassword: string;
  ecommercePlatform: string;
  gateway: string;
  legalAddr1: string;
  legalAddr2: string;
  legalCity: string;
  legalState: string;
  legalZip: string;
  locAddr1: string;
  locAddr2: string;
  locCity: string;
  locState: string;
  locZip: string;
  separateMailing: boolean;
  mailAddr1: string;
  mailAddr2: string;
  mailCity: string;
  mailState: string;
  mailZip: string;
  firstName: string;
  lastName: string;
  title: string;
  phone: string;
  email: string;
  vmdMonthly: string;
  amexMonthly: string;
  internetPct: string;
  retailPct: string;
  keyedPct: string;
  notes: string;
};

type FieldKey = keyof FormData | "acceptance";

type FieldProps = {
  label: React.ReactNode;
  required?: boolean;
  hint?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
};

type InputProps = {
  value?: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
};

type SelectProps = {
  value?: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
};

type CurrencyInputProps = {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

type PercentInputProps = {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

type SectionProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
};

type ProgressSegmentsProps = {
  steps: Step[];
  activeIndex: number;
};

type ReviewRowProps = {
  k: React.ReactNode;
  v: React.ReactNode;
};

// Minimal, Stripe-ish multi-step form preview
// - White background
// - Green CTAs
// - Segmented progress bar
// - Basic validation incl. method-of-acceptance must equal 100%

const GREEN = "bg-emerald-600";
const GREEN_HOVER = "hover:bg-emerald-700";

const STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

const CORP_STRUCTURES = [
  "Sole Proprietorship",
  "Unincorporated Association",
  "Trust (Not Formed By State Filing)",
  "Government Entity",
  "Public Corporation",
  "Company Registered with SEC",
  "Financial Institution",
  "Non-Profit",
  "Non-Excluded Pooled Investment Vehicle",
  "Limited Liability Company (LLC, Ltd, LC, PLLC)",
  "Partnership (LP, LLP, LLLP, GP)",
  "C Corporation",
  "S Corporation",
  "Trust (Business Trust)",
  "Joint Venture",
  "Other (Please contact account officer)",
];

const GATEWAYS = [
  "NMI",
  "Authorize.net",
  "Linked2Pay",
  "USAePay",
  "Dejavoo",
  "Valor",
  "Stripe",
  "Square",
  "PayTrace",
  "Other",
];

const INDUSTRIES = [
  // long list in real app would be searchable
  "Insurance",
  "Adult",
  "Advertising Services",
  "Affiliate Marketing",
  "Airline, Lodging, Travel",
  "Alcohol",
  "Auto Sales",
  "Auto Warranties",
  "Background Checks",
  "Bail Bonds",
  "Beauty, Skin & Hair Care",
  "Business Opportunities",
  "Cannabis Dispensary",
  "CBD",
  "CNP Pharmacies",
  "Charities",
  "Coins & Collectables",
  "Computer Sales",
  "Credit Repair & Monitoring",
  "Cryptocurrencies",
  "Dating",
  "Debt Collection",
  "Domain Registration",
  "Drugs & Drug Products",
  "Events & Tickets",
  "E-Wallets",
  "Fantasy Sports",
  "File Sharing",
  "Firearm Sales",
  "Gambling",
  "Gentleman’s Club",
  "Government Grants",
  "Health",
  "Coaching",
  "ISP’s & Web Hosting",
  "Jewelry",
  "Kratom",
  "Male Enhancement",
  "Marketing",
  "Merchant Aggregators",
  "Money Transfer",
  "Monthly Membership",
  "Moving Services",
  "Nutraceutical",
  "Merchant Service for Online Auctions",
  "Pawn Shops",
  "Peptide",
  "Pet Sales & Accessories",
  "Phone Unlocking Services",
  "Prepaid Phone Cards",
  "Prop Firm",
  "Pyramid Selling / Network Marketing",
  "Restaurants",
  "Self Storage",
  "Smoke Shop",
  "SAAS",
  "Subscription Boxes",
  "Tech Support",
  "Telemedicine",
  "Ticket Brokers",
  "Timeshares & Holiday Clubs",
  "Vape / E-Cig",
  "VPN Services",
  "Web Design / Marketing",
  "Other",
];

function cx(...parts: ClassValue[]) {
  return parts.filter((part): part is string => Boolean(part)).join(" ");
}

function Field({ label, required, hint, error, children }: FieldProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-900">
          {label}
          {required ? <span className="text-emerald-700"> *</span> : null}
        </label>
        {hint ? <div className="text-xs text-slate-500">{hint}</div> : null}
      </div>
      {children}
      {error ? <div className="text-xs text-rose-600">{error}</div> : null}
    </div>
  );
}

function Input({ value, onChange, type = "text", placeholder, autoComplete }: InputProps) {
  return (
    <input
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      type={type}
      placeholder={placeholder}
      autoComplete={autoComplete}
      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
    />
  );
}

function Select({ value, onChange, options, placeholder = "Select…" }: SelectProps) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function CurrencyInput({ value, onChange, placeholder = "0.00" }: CurrencyInputProps) {
  const display = value ?? "";
  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-400">
        $
      </div>
      <input
        value={display}
        onChange={(e) => {
          const v = e.target.value;
          // allow digits, commas, dot
          if (!/^[0-9,]*\.?[0-9]*$/.test(v)) return;
          onChange(v);
        }}
        placeholder={placeholder}
        inputMode="decimal"
        className="w-full rounded-xl border border-slate-200 bg-white pl-7 pr-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
      />
    </div>
  );
}

function PercentInput({ value, onChange, placeholder = "0" }: PercentInputProps) {
  const display = value ?? "";
  return (
    <div className="relative">
      <input
        value={display}
        onChange={(e) => {
          const v = e.target.value;
          if (!/^\d{0,3}$/.test(v)) return;
          onChange(v);
        }}
        placeholder={placeholder}
        inputMode="numeric"
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 pr-9 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
      />
      <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-400">
        %
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }: SectionProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <div className="text-lg font-semibold text-slate-900">{title}</div>
        {subtitle ? <div className="mt-1 text-sm text-slate-600">{subtitle}</div> : null}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
    </div>
  );
}

function ProgressSegments({ steps, activeIndex }: ProgressSegmentsProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-slate-600">
          Step {activeIndex + 1} of {steps.length}
        </div>
        <div className="text-xs text-slate-500">{steps[activeIndex].label}</div>
      </div>
      <div className="flex gap-2">
        {steps.map((_, i) => (
          <div
            key={i}
            className={cx(
              "h-2 w-full rounded-full",
              i <= activeIndex ? "bg-emerald-600" : "bg-slate-200"
            )}
          />
        ))}
      </div>
    </div>
  );
}

export default function EnterpriseMultiStepMerchantFormPreview() {
  const steps = useMemo<Step[]>(
    () => [
      { key: "company", label: "Company" },
      { key: "merch", label: "Merchandise" },
      { key: "online", label: "Online & Gateway" },
      { key: "address", label: "Addresses" },
      { key: "contact", label: "Primary Contact" },
      { key: "volume", label: "Volumes" },
      { key: "accept", label: "Acceptance" },
      { key: "notes", label: "Notes" },
      { key: "review", label: "Review" },
    ],
    []
  );

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});

  const [data, setData] = useState<FormData>({
    // Section 1
    dbaName: "",
    legalName: "",
    corpStructure: "",

    // Section 2
    industry: "",

    // Section 3
    websiteUrl: "",
    websiteLogin: "",
    websitePassword: "",
    ecommercePlatform: "",

    // Section 4
    gateway: "",

    // Section 5
    legalAddr1: "",
    legalAddr2: "",
    legalCity: "",
    legalState: "",
    legalZip: "",

    locAddr1: "",
    locAddr2: "",
    locCity: "",
    locState: "",
    locZip: "",

    separateMailing: false,
    mailAddr1: "",
    mailAddr2: "",
    mailCity: "",
    mailState: "",
    mailZip: "",

    // Section 6
    firstName: "",
    lastName: "",
    title: "",
    phone: "",
    email: "",

    // Section 7
    vmdMonthly: "",
    amexMonthly: "",

    // Section 8
    internetPct: "",
    retailPct: "",
    keyedPct: "",

    // Section 9
    notes: "",
  });

  function update(patch: Partial<FormData>) {
    setData((d) => ({ ...d, ...patch }));
  }

  const acceptanceTotal =
    (parseInt(data.internetPct || "0", 10) || 0) +
    (parseInt(data.retailPct || "0", 10) || 0) +
    (parseInt(data.keyedPct || "0", 10) || 0);

  const errors = useMemo<Partial<Record<FieldKey, string>>>(() => {
    const e: Partial<Record<FieldKey, string>> = {};

    // Required
    if (!data.dbaName.trim()) e.dbaName = "Required";
    if (!data.legalName.trim()) e.legalName = "Required";
    if (!data.corpStructure) e.corpStructure = "Required";

    if (!data.industry) e.industry = "Required";

    // Website URL optional, but if present must be plausible
    if (data.websiteUrl.trim()) {
      const ok = /^https?:\/\//i.test(data.websiteUrl.trim());
      if (!ok) e.websiteUrl = "Start with http:// or https://";
    }

    // Gateway optional in spec, but often required; keep optional for preview

    // Addresses (basic)
    if (!data.legalAddr1.trim()) e.legalAddr1 = "Required";
    if (!data.legalCity.trim()) e.legalCity = "Required";
    if (!data.legalState) e.legalState = "Required";
    if (!data.legalZip.trim()) e.legalZip = "Required";

    if (!data.locAddr1.trim()) e.locAddr1 = "Required";
    if (!data.locCity.trim()) e.locCity = "Required";
    if (!data.locState) e.locState = "Required";
    if (!data.locZip.trim()) e.locZip = "Required";

    if (data.separateMailing) {
      if (!data.mailAddr1.trim()) e.mailAddr1 = "Required";
      if (!data.mailCity.trim()) e.mailCity = "Required";
      if (!data.mailState) e.mailState = "Required";
      if (!data.mailZip.trim()) e.mailZip = "Required";
    }

    // Contact
    if (!data.firstName.trim()) e.firstName = "Required";
    if (!data.lastName.trim()) e.lastName = "Required";
    if (!data.phone.trim()) e.phone = "Required";
    if (!data.email.trim()) e.email = "Required";
    if (data.email.trim() && !/^\S+@\S+\.\S+$/.test(data.email.trim())) e.email = "Enter a valid email";

    // Acceptance must equal 100
    if (acceptanceTotal !== 100) e.acceptance = "Totals must equal 100%";

    return e;
  }, [data, acceptanceTotal]);

  function markTouched(fields: FieldKey[]) {
    setTouched((t) => {
      const next: Partial<Record<FieldKey, boolean>> = { ...t };
      fields.forEach((f) => {
        next[f] = true;
      });
      return next;
    });
  }

  function stepFields(index: number): FieldKey[] {
    switch (steps[index].key) {
      case "company":
        return ["dbaName", "legalName", "corpStructure"];
      case "merch":
        return ["industry"];
      case "online":
        return ["websiteUrl"]; // optional-ish; only show error if invalid format
      case "address": {
        const base: FieldKey[] = [
          "legalAddr1",
          "legalCity",
          "legalState",
          "legalZip",
          "locAddr1",
          "locCity",
          "locState",
          "locZip",
        ];
        if (data.separateMailing) base.push("mailAddr1", "mailCity", "mailState", "mailZip");
        return base;
      }
      case "contact":
        return ["firstName", "lastName", "phone", "email"];
      case "volume":
        return []; // optional
      case "accept":
        return ["acceptance"]; // virtual
      case "notes":
        return []; // optional
      case "review":
        return []; // no validation step
      default:
        return [];
    }
  }

  function stepHasErrors(index: number): boolean {
    const fields = stepFields(index);
    // special: acceptance virtual field
    if (fields.includes("acceptance")) return Boolean(errors.acceptance);
    return fields.some((f) => Boolean(errors[f]));
  }

  function next() {
    const fields = stepFields(step);
    markTouched(fields);
    if (stepHasErrors(step)) return;
    setStep((s) => Math.min(s + 1, steps.length - 1));
  }

  function back() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function submit() {
    try {
      setSubmitting(true);

      const res = await fetch("/api/lead", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        throw new Error("Submission failed");
      }

      alert("Application submitted successfully. A representative will follow up shortly.");

    } catch (err) {
      console.error(err);
      alert("There was an error submitting the application. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const headerTitle = "Greenhub New Merchant Application";
  const headerSubtitle = "Get a Free Processing Review";

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-8">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="mb-3">
                <Image
                  src="/images/logo.png"
                  alt="Greenhub"
                  width={160}
                  height={40}
                  className="h-8 w-auto"
                  priority
                />
              </div>
              <div className="text-2xl font-semibold tracking-tight text-slate-900">
                {headerTitle}
              </div>
              <div className="mt-1 text-sm text-slate-600">{headerSubtitle}</div>
            </div>
            <div className="hidden md:block">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
                <span className="h-2 w-2 rounded-full bg-emerald-600" />
                Secure application
              </span>
            </div>
          </div>
          <div className="mt-5">
            <ProgressSegments steps={steps} activeIndex={step} />
          </div>
        </div>

        {/* STEP CONTENT */}
        <div className="space-y-5">
          {steps[step].key === "company" ? (
            <Section
              title="Company details"
              subtitle="Tell us about the business you want to process for."
            >
              <Field
                label="(DBA) Merchant Name"
                required
                error={touched.dbaName ? errors.dbaName : ""}
              >
                <Input
                  value={data.dbaName}
                  onChange={(v) => update({ dbaName: v })}
                  placeholder="Greenhub Media"
                  autoComplete="organization"
                />
              </Field>

              <Field
                label="Legal Business Name"
                required
                error={touched.legalName ? errors.legalName : ""}
              >
                <Input
                  value={data.legalName}
                  onChange={(v) => update({ legalName: v })}
                  placeholder="Greenhub Media LLC"
                />
              </Field>

              <div className="md:col-span-2">
                <Field
                  label="Corp Structure"
                  required
                  error={touched.corpStructure ? errors.corpStructure : ""}
                >
                  <Select
                    value={data.corpStructure}
                    onChange={(v) => update({ corpStructure: v })}
                    options={CORP_STRUCTURES}
                    placeholder="Select a structure…"
                  />
                </Field>
              </div>
            </Section>
          ) : null}

          {steps[step].key === "merch" ? (
            <Section
              title="Merchandise / services sold"
              subtitle="Choose the best match (searchable dropdown in production)."
            >
              <div className="md:col-span-2">
                <Field label="Merchandise / Services Sold" required error={touched.industry ? errors.industry : ""}>
                  <Select
                    value={data.industry}
                    onChange={(v) => update({ industry: v })}
                    options={INDUSTRIES}
                    placeholder="Select an industry…"
                  />
                </Field>
              </div>
            </Section>
          ) : null}

          {steps[step].key === "online" ? (
            <div className="space-y-5">
              <Section title="Online & tech details" subtitle="Optional fields — add what’s available.">
                <div className="md:col-span-2">
                  <Field
                    label="Website URL"
                    error={touched.websiteUrl ? errors.websiteUrl : ""}
                    hint="Include https://"
                  >
                    <Input
                      value={data.websiteUrl}
                      onChange={(v) => update({ websiteUrl: v })}
                      placeholder="https://example.com"
                      autoComplete="url"
                    />
                  </Field>
                </div>

                <Field label="Website Login">
                  <Input
                    value={data.websiteLogin}
                    onChange={(v) => update({ websiteLogin: v })}
                    placeholder="(optional)"
                    autoComplete="username"
                  />
                </Field>

                <Field label="Website Password" hint="Avoid sharing sensitive info unless requested">
                  <Input
                    value={data.websitePassword}
                    onChange={(v) => update({ websitePassword: v })}
                    placeholder="(optional)"
                    type="password"
                    autoComplete="current-password"
                  />
                </Field>

                <div className="md:col-span-2">
                  <Field label="E-Commerce Platform">
                    <Input
                      value={data.ecommercePlatform}
                      onChange={(v) => update({ ecommercePlatform: v })}
                      placeholder="Shopify, WooCommerce, custom…"
                    />
                  </Field>
                </div>
              </Section>

              <Section title="Payment gateway" subtitle="Select what you use today (or plan to use).">
                <div className="md:col-span-2">
                  <Field label="Gateway">
                    <Select
                      value={data.gateway}
                      onChange={(v) => update({ gateway: v })}
                      options={GATEWAYS}
                      placeholder="Select a gateway…"
                    />
                  </Field>
                </div>
              </Section>
            </div>
          ) : null}

          {steps[step].key === "address" ? (
            <div className="space-y-5">
              <Section title="Legal business address" subtitle="Where the business is registered.">
                <div className="md:col-span-2">
                  <Field label="Address" required error={touched.legalAddr1 ? errors.legalAddr1 : ""}>
                    <Input value={data.legalAddr1} onChange={(v) => update({ legalAddr1: v })} placeholder="123 Main St" autoComplete="address-line1" />
                  </Field>
                </div>
                <div className="md:col-span-2">
                  <Field label="Address 2">
                    <Input value={data.legalAddr2} onChange={(v) => update({ legalAddr2: v })} placeholder="Suite / Unit" autoComplete="address-line2" />
                  </Field>
                </div>
                <Field label="City" required error={touched.legalCity ? errors.legalCity : ""}>
                  <Input value={data.legalCity} onChange={(v) => update({ legalCity: v })} placeholder="Miami" autoComplete="address-level2" />
                </Field>
                <Field label="State" required error={touched.legalState ? errors.legalState : ""}>
                  <Select value={data.legalState} onChange={(v) => update({ legalState: v })} options={STATES} placeholder="Select…" />
                </Field>
                <Field label="Zip" required error={touched.legalZip ? errors.legalZip : ""}>
                  <Input value={data.legalZip} onChange={(v) => update({ legalZip: v })} placeholder="33101" autoComplete="postal-code" />
                </Field>
              </Section>

              <Section title="Business location address" subtitle="Where business operates (if different).">
                <div className="md:col-span-2">
                  <Field label="Address" required error={touched.locAddr1 ? errors.locAddr1 : ""}>
                    <Input value={data.locAddr1} onChange={(v) => update({ locAddr1: v })} placeholder="123 Main St" />
                  </Field>
                </div>
                <div className="md:col-span-2">
                  <Field label="Address 2">
                    <Input value={data.locAddr2} onChange={(v) => update({ locAddr2: v })} placeholder="Suite / Unit" />
                  </Field>
                </div>
                <Field label="City" required error={touched.locCity ? errors.locCity : ""}>
                  <Input value={data.locCity} onChange={(v) => update({ locCity: v })} placeholder="Miami" />
                </Field>
                <Field label="State" required error={touched.locState ? errors.locState : ""}>
                  <Select value={data.locState} onChange={(v) => update({ locState: v })} options={STATES} placeholder="Select…" />
                </Field>
                <Field label="Zip" required error={touched.locZip ? errors.locZip : ""}>
                  <Input value={data.locZip} onChange={(v) => update({ locZip: v })} placeholder="33101" />
                </Field>

                <div className="md:col-span-2 mt-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={data.separateMailing}
                      onChange={(e) => update({ separateMailing: e.target.checked })}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-200"
                    />
                    <div>
                      <div className="text-sm font-medium text-slate-900">Separate mailing address</div>
                      <div className="text-xs text-slate-600">If checked, we’ll collect a mailing address.</div>
                    </div>
                  </label>
                </div>

                {data.separateMailing ? (
                  <div className="md:col-span-2">
                    <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="md:col-span-2">
                        <Field label="Mailing Address" required error={touched.mailAddr1 ? errors.mailAddr1 : ""}>
                          <Input value={data.mailAddr1} onChange={(v) => update({ mailAddr1: v })} placeholder="123 Main St" />
                        </Field>
                      </div>
                      <div className="md:col-span-2">
                        <Field label="Address 2">
                          <Input value={data.mailAddr2} onChange={(v) => update({ mailAddr2: v })} placeholder="Suite / Unit" />
                        </Field>
                      </div>
                      <Field label="City" required error={touched.mailCity ? errors.mailCity : ""}>
                        <Input value={data.mailCity} onChange={(v) => update({ mailCity: v })} placeholder="Miami" />
                      </Field>
                      <Field label="State" required error={touched.mailState ? errors.mailState : ""}>
                        <Select value={data.mailState} onChange={(v) => update({ mailState: v })} options={STATES} placeholder="Select…" />
                      </Field>
                      <Field label="Zip" required error={touched.mailZip ? errors.mailZip : ""}>
                        <Input value={data.mailZip} onChange={(v) => update({ mailZip: v })} placeholder="33101" />
                      </Field>
                    </div>
                  </div>
                ) : null}
              </Section>
            </div>
          ) : null}

          {steps[step].key === "contact" ? (
            <Section title="Primary contact" subtitle="Who should we follow up with?">
              <Field label="First Name" required error={touched.firstName ? errors.firstName : ""}>
                <Input value={data.firstName} onChange={(v) => update({ firstName: v })} placeholder="John" autoComplete="given-name" />
              </Field>
              <Field label="Last Name" required error={touched.lastName ? errors.lastName : ""}>
                <Input value={data.lastName} onChange={(v) => update({ lastName: v })} placeholder="Doe" autoComplete="family-name" />
              </Field>
              <Field label="Title">
                <Input value={data.title} onChange={(v) => update({ title: v })} placeholder="Owner / Founder" />
              </Field>
              <Field label="Phone" required error={touched.phone ? errors.phone : ""}>
                <Input value={data.phone} onChange={(v) => update({ phone: v })} placeholder="(555) 555-5555" autoComplete="tel" />
              </Field>
              <div className="md:col-span-2">
                <Field label="Email" required error={touched.email ? errors.email : ""}>
                  <Input value={data.email} onChange={(v) => update({ email: v })} placeholder="you@company.com" autoComplete="email" />
                </Field>
              </div>
            </Section>
          ) : null}

          {steps[step].key === "volume" ? (
            <Section title="Processing volumes" subtitle="Estimates are fine — helps us size the right program.">
              <Field label="Visa/MC/Discover Monthly Volume">
                <CurrencyInput value={data.vmdMonthly} onChange={(v) => update({ vmdMonthly: v })} />
              </Field>
              <Field label="American Express Monthly Volume">
                <CurrencyInput value={data.amexMonthly} onChange={(v) => update({ amexMonthly: v })} />
              </Field>
            </Section>
          ) : null}

          {steps[step].key === "accept" ? (
            <Section
              title="Method of acceptance"
              subtitle="Totals must equal 100%."
            >
              <Field label="Internet %" required>
                <PercentInput value={data.internetPct} onChange={(v) => update({ internetPct: v })} />
              </Field>
              <Field label="Retail / Swiped %" required>
                <PercentInput value={data.retailPct} onChange={(v) => update({ retailPct: v })} />
              </Field>
              <Field label="Keyed MO/TO %" required>
                <PercentInput value={data.keyedPct} onChange={(v) => update({ keyedPct: v })} />
              </Field>

              <div className="md:col-span-2">
                <div
                  className={cx(
                    "flex items-center justify-between rounded-xl border px-4 py-3 text-sm",
                    acceptanceTotal === 100
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                      : "border-rose-200 bg-rose-50 text-rose-900"
                  )}
                >
                  <div className="font-medium">Total</div>
                  <div className="font-semibold">{acceptanceTotal}%</div>
                </div>
                {touched.acceptance && errors.acceptance ? (
                  <div className="mt-2 text-xs text-rose-600">{errors.acceptance}</div>
                ) : null}
              </div>
            </Section>
          ) : null}

          {steps[step].key === "notes" ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5">
                <div className="text-lg font-semibold text-slate-900">Notes</div>
                <div className="mt-1 text-sm text-slate-600">Anything we should know (processing history, approvals, special requirements)?</div>
              </div>
              <textarea
                value={data.notes}
                onChange={(e) => update({ notes: e.target.value })}
                placeholder="Write notes here…"
                className="min-h-[140px] w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
              <div className="mt-3 text-xs text-slate-500">
                Tip: avoid including sensitive passwords unless requested — route securely.
              </div>
            </div>
          ) : null}

          {steps[step].key === "review" ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-lg font-semibold text-slate-900">Review</div>
                    <div className="mt-1 text-sm text-slate-600">Confirm details before submitting.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(0)}
                    className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
                  >
                    Edit
                  </button>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <ReviewRow k="DBA" v={data.dbaName} />
                  <ReviewRow k="Legal Name" v={data.legalName} />
                  <ReviewRow k="Corp Structure" v={data.corpStructure} />
                  <ReviewRow k="Industry" v={data.industry} />
                  <ReviewRow k="Website" v={data.websiteUrl || "—"} />
                  <ReviewRow k="Gateway" v={data.gateway || "—"} />
                  <ReviewRow k="Contact" v={`${data.firstName} ${data.lastName}`.trim() || "—"} />
                  <ReviewRow k="Email" v={data.email || "—"} />
                  <ReviewRow k="Phone" v={data.phone || "—"} />
                  <ReviewRow k="V/MC/Disc" v={data.vmdMonthly ? `$${data.vmdMonthly}` : "—"} />
                  <ReviewRow k="Amex" v={data.amexMonthly ? `$${data.amexMonthly}` : "—"} />
                  <ReviewRow k="Acceptance" v={`${acceptanceTotal}% (Internet ${data.internetPct || 0} / Retail ${data.retailPct || 0} / Keyed ${data.keyedPct || 0})`} />
                  <div className="md:col-span-2">
                    <div className="rounded-xl border border-slate-200 p-4">
                      <div className="text-xs font-medium text-slate-500">Notes</div>
                      <div className="mt-1 whitespace-pre-wrap text-sm text-slate-900">{data.notes || "—"}</div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          ) : null}

          {/* FOOTER NAV */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={back}
                disabled={step === 0}
                className={cx(
                  "inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium shadow-sm transition",
                  step === 0
                    ? "cursor-not-allowed border-slate-200 bg-white text-slate-300"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                )}
              >
                Back
              </button>

              {steps[step].key !== "review" ? (
                <button
                  type="button"
                  onClick={next}
                  className={cx(
                    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition",
                    GREEN,
                    GREEN_HOVER
                  )}
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    // ensure acceptance validation visible if user jumps here
                    markTouched(["acceptance"]);
                    if (errors.acceptance) {
                      setStep(6);
                      return;
                    }
                    // touch critical required fields for a final gate
                    const critical: FieldKey[] = [
                      "dbaName",
                      "legalName",
                      "corpStructure",
                      "industry",
                      "legalAddr1",
                      "legalCity",
                      "legalState",
                      "legalZip",
                      "locAddr1",
                      "locCity",
                      "locState",
                      "locZip",
                      "firstName",
                      "lastName",
                      "phone",
                      "email",
                    ];
                    markTouched(critical);
                    const hasAny = critical.some((k) => Boolean(errors[k]));
                    if (hasAny) {
                      // find first step with errors and jump there
                      const firstBad = steps.findIndex((_, i) => stepHasErrors(i));
                      setStep(firstBad === -1 ? 0 : firstBad);
                      return;
                    }
                    submit();
                  }}
                  className={cx(
                    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition",
                    GREEN,
                    GREEN_HOVER
                  )}
                >
                  {submitting ? "Submitting..." : "Submit application"}
                </button>
              )}
            </div>

            <div className="text-xs text-slate-500">
              Secure application. Your information will be transmitted safely.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewRow({ k, v }: ReviewRowProps) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="text-xs font-medium text-slate-500">{k}</div>
      <div className="mt-1 text-sm font-medium text-slate-900">{v || "—"}</div>
    </div>
  );
}
