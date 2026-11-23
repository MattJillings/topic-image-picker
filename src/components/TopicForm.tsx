"use client";

import { useEffect, useState, type FormEvent } from "react";
import { MAX_TOPIC_LENGTH, TOPICS, type Topic, type UserDetails } from "@/lib/types";

interface TopicFormProps {
  initialValues?: UserDetails | null;
  onSubmit: (details: UserDetails) => void;
}

type Field = "name" | "surname" | "topic" | "other";
type Errors = Partial<Record<Field, string>>;

interface Values {
  name: string;
  surname: string;
  topic: Topic | "";
  other: string;
}

const FIELD_ORDER: Field[] = ["name", "surname", "topic", "other"];
const fieldId = (f: Field) => `field-${f}`;
const errorId = (f: Field) => `field-${f}-error`;

const inputBase =
  "w-full rounded-lg border bg-white px-3 py-2 text-slate-900 shadow-sm transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";
const inputClass = (invalid: boolean) =>
  `${inputBase} ${invalid ? "border-red-700 border-2" : "border-slate-500"}`;

function initialValuesFrom(values?: UserDetails | null): Values {
  if (!values) return { name: "", surname: "", topic: "", other: "" };
  const match = TOPICS.find((t) => t !== "Other" && t === values.topic);
  return {
    name: values.name,
    surname: values.surname,
    topic: match ?? "Other",
    other: match ? "" : values.topic,
  };
}

function validate(v: Values): Errors {
  const errors: Errors = {};
  if (!v.name.trim()) errors.name = "Enter your name.";
  if (!v.surname.trim()) errors.surname = "Enter your surname.";
  if (!v.topic) errors.topic = "Choose a preferred topic.";
  if (v.topic === "Other") {
    const other = v.other.trim();
    if (!other) errors.other = "Enter your topic.";
    else if (other.length > MAX_TOPIC_LENGTH) errors.other = `Your topic must be ${MAX_TOPIC_LENGTH} characters or fewer.`;
  }
  return errors;
}

export default function TopicForm({ initialValues, onSubmit }: TopicFormProps) {
  const [values, setValues] = useState<Values>(() => initialValuesFrom(initialValues));
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);

  // After a failed submit, move focus to the first invalid field. This runs after render, so the
  // field's error is already linked via aria-describedby and screen readers announce it with the label.
  useEffect(() => {
    if (focusRequest === 0) return;
    const first = FIELD_ORDER.find((f) => errors[f]);
    if (first) document.getElementById(fieldId(first))?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on a new failed submit, not on every edit
  }, [focusRequest]);

  function update<K extends keyof Values>(key: K, value: Values[K]) {
    const next = { ...values, [key]: value };
    setValues(next);
    // Once the user has tried to submit, re-validate live so fixed errors disappear.
    if (submitted) setErrors(validate(next));
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
    const nextErrors = validate(values);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setFocusRequest((n) => n + 1);
      return;
    }

    onSubmit({
      name: values.name.trim(),
      surname: values.surname.trim(),
      topic: values.topic === "Other" ? values.other.trim() : values.topic,
    });
  }

  const describedBy = (f: Field, extra?: string) =>
    [extra, errors[f] ? errorId(f) : null].filter(Boolean).join(" ") || undefined;

  const fieldError = (field: Field) =>
    errors[field] ? (
      <p id={errorId(field)} className="text-sm font-medium text-red-700">
        <span className="sr-only">Error: </span>
        {errors[field]}
      </p>
    ) : null;

  const label = (field: Field, children: React.ReactNode) => (
    <label htmlFor={fieldId(field)} className="block text-sm font-medium text-slate-800">
      {children}
      {/* Visual marker only: the field's `required` attribute tells assistive tech it's required. */}
      <span aria-hidden="true" className="ml-0.5">
        *
      </span>
    </label>
  );

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          {label("name", "Name")}
          <input
            id={fieldId("name")}
            className={inputClass(!!errors.name)}
            value={values.name}
            onChange={(e) => update("name", e.target.value)}
            autoComplete="given-name"
            required
            aria-invalid={!!errors.name}
            aria-describedby={describedBy("name")}
          />
          {fieldError("name")}
        </div>
        <div className="space-y-1.5">
          {label("surname", "Surname")}
          <input
            id={fieldId("surname")}
            className={inputClass(!!errors.surname)}
            value={values.surname}
            onChange={(e) => update("surname", e.target.value)}
            autoComplete="family-name"
            required
            aria-invalid={!!errors.surname}
            aria-describedby={describedBy("surname")}
          />
          {fieldError("surname")}
        </div>
      </div>

      <div className="space-y-1.5">
        {label("topic", "Preferred topic")}
        <select
          id={fieldId("topic")}
          className={inputClass(!!errors.topic)}
          value={values.topic}
          onChange={(e) => update("topic", e.target.value as Topic | "")}
          required
          aria-invalid={!!errors.topic}
          aria-describedby={describedBy("topic")}
        >
          <option value="" disabled>
            Select a topic…
          </option>
          {TOPICS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {fieldError("topic")}
      </div>

      {values.topic === "Other" && (
        <div className="space-y-1.5">
          {label("other", "Your topic")}
          <p id="field-other-hint" className="text-sm text-slate-600">
            For example Mountains, Coffee or Architecture.
          </p>
          <input
            id={fieldId("other")}
            className={inputClass(!!errors.other)}
            value={values.other}
            onChange={(e) => update("other", e.target.value)}
            maxLength={MAX_TOPIC_LENGTH}
            required
            aria-invalid={!!errors.other}
            aria-describedby={describedBy("other", "field-other-hint field-other-count")}
          />
          {fieldError("other")}
          <p id="field-other-count" className="text-sm text-slate-600">
            {values.other.length} of {MAX_TOPIC_LENGTH} characters used
          </p>
        </div>
      )}

      <button
        type="submit"
        className="w-full rounded-lg rounded-tr-none rounded-bl-none bg-brand px-4 py-2.5 font-semibold text-white shadow-sm transition hover:bg-brand-dark"
      >
        Find an image
      </button>

      <p className="text-sm text-slate-600">
        <span aria-hidden="true">*</span> Required fields
      </p>
    </form>
  );
}
