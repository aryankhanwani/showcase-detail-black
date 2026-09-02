"use client";

import { motion } from "motion/react";
import { useState, type FormEvent } from "react";
import { segments, services } from "@/content/studio";
import { cn } from "@/lib/cn";
import type { EnquiryResult, EnquiryValues } from "./types";

const FIELD =
  "surface-1 w-full rounded-field border border-line-strong px-4 py-3.5 text-[15.5px] text-paper outline-none transition-colors placeholder:text-paper-faint focus:border-gold/50 focus:surface-2";

const EASE = [0.22, 1, 0.36, 1] as const;

const EMPTY: EnquiryValues = {
  name: "",
  phone: "",
  email: "",
  segment: "",
  vehicle: "",
  service: "",
  message: "",
};

/**
 * The enquiry form. On success it hands its values *and* the server's answer up
 * to the panel, which is what lets the chat open already knowing the car —
 * nothing is re-fetched and nothing is re-asked.
 */
export function EnquiryForm({
  onSuccess,
}: {
  onSuccess: (values: EnquiryValues, result: EnquiryResult) => void;
}) {
  const [values, setValues] = useState<EnquiryValues>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof EnquiryValues, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const set = (key: keyof EnquiryValues) => (value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, source: "/contact" }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.fieldErrors) setErrors(data.fieldErrors);
        setFormError(data.error ?? "Something went wrong.");
        setSubmitting(false);
        return;
      }

      onSuccess(values, data as EnquiryResult);
    } catch {
      setFormError("We could not reach the studio. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Your name"
          name="name"
          value={values.name}
          onChange={set("name")}
          error={errors.name}
          autoComplete="name"
          placeholder="Rohan Mehta"
        />
        <Field
          label="Mobile"
          name="phone"
          type="tel"
          value={values.phone}
          onChange={set("phone")}
          error={errors.phone}
          autoComplete="tel-national"
          placeholder="98250 41200"
          prefix="+91"
        />
      </div>

      <Field
        label="Email"
        name="email"
        type="email"
        value={values.email}
        onChange={set("email")}
        error={errors.email}
        autoComplete="email"
        placeholder="you@example.com"
        optional
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Your car"
          name="vehicle"
          value={values.vehicle}
          onChange={set("vehicle")}
          error={errors.vehicle}
          placeholder="2022 Hyundai Creta"
        />
        <Select
          label="Segment"
          name="segment"
          value={values.segment}
          onChange={set("segment")}
          error={errors.segment}
          placeholder="Pick a segment"
          options={segments.map((s) => ({ value: s.id, label: `${s.label} — ${s.example}` }))}
        />
      </div>

      <Select
        label="What are you after"
        name="service"
        value={values.service}
        onChange={set("service")}
        error={errors.service}
        placeholder="Pick a service"
        options={services.map((s) => ({ value: s.slug, label: s.name }))}
      />

      <div>
        <Label htmlFor="message" optional>
          Anything else
        </Label>
        <textarea
          id="message"
          name="message"
          rows={3}
          value={values.message}
          onChange={(e) => set("message")(e.target.value)}
          placeholder="Swirls under sunlight, a few stone chips on the bonnet…"
          className={cn(FIELD, "resize-none")}
        />
      </div>

      {formError ? (
        <p role="alert" className="text-[14.5px] text-gold-soft">
          {formError}
        </p>
      ) : null}

      <motion.button
        type="submit"
        disabled={submitting}
        whileTap={{ scale: 0.985 }}
        className="press t-label flex w-full items-center justify-center gap-2.5 rounded-pill bg-paper px-7 py-4 text-ink transition-opacity duration-200 hover:opacity-90 disabled:opacity-60"
      >
        {submitting ? (
          <>
            <motion.span
              aria-hidden
              className="block size-3.5 rounded-full border-2 border-ink/25 border-t-ink"
              animate={{ rotate: 360 }}
              transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
            />
            Opening the chat
          </>
        ) : (
          <>
            Start the conversation
            <span aria-hidden>→</span>
          </>
        )}
      </motion.button>

      <p className="text-[13.5px] leading-relaxed text-paper-faint">
        This opens a chat with the studio assistant, already holding everything
        you have typed above. It will not ask you to repeat any of it.
      </p>
    </form>
  );
}

/* ── Field parts ────────────────────────────────────────────────────────── */

function Label({
  htmlFor,
  children,
  optional,
}: {
  htmlFor: string;
  children: React.ReactNode;
  optional?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="t-label mb-2.5 block text-paper-faint">
      {children}
      {optional ? <span className="ml-1.5 text-paper-faint/60">optional</span> : null}
    </label>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  error,
  type = "text",
  placeholder,
  autoComplete,
  prefix,
  optional,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  prefix?: string;
  optional?: boolean;
}) {
  return (
    <div>
      <Label htmlFor={name} optional={optional}>
        {label}
      </Label>
      <div className="relative">
        {prefix ? (
          <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[15.5px] text-paper-faint">
            {prefix}
          </span>
        ) : null}
        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${name}-error` : undefined}
          className={cn(FIELD, prefix && "pl-14", error && "border-gold/70")}
        />
      </div>
      {error ? (
        <p id={`${name}-error`} className="mt-2 text-[13.5px] text-gold-soft">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Select({
  label,
  name,
  value,
  onChange,
  error,
  placeholder,
  options,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <div className="relative">
        <select
          id={name}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${name}-error` : undefined}
          className={cn(
            FIELD,
            "appearance-none pr-10",
            !value && "text-paper-faint",
            error && "border-gold/70",
          )}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((option) => (
            <option key={option.value} value={option.value} className="bg-ink-2 text-paper">
              {option.label}
            </option>
          ))}
        </select>
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-paper-faint"
        >
          ↓
        </span>
      </div>
      {error ? (
        <p id={`${name}-error`} className="mt-2 text-[13.5px] text-gold-soft">
          {error}
        </p>
      ) : null}
    </div>
  );
}
