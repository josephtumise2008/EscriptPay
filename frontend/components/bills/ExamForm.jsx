"use client";

import { useState } from "react";
import { GraduationCap, KeyRound, UserRound, Smartphone, Clock } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { validateNigerianPhone } from "@/lib/validators";
import { formatNaira } from "@/lib/format";
import { useBillsCatalog, useAccountCheck, useBillOrder } from "./useBills";
import { BillCheckout, Step, ChoiceGrid, AccountField, PhoneField, CatalogState } from "./BillCheckout";

export default function ExamForm({ initialExam = "waec" }) {
  const { user } = useAuth();
  const { catalog, error, loading, reload } = useBillsCatalog();
  const exams = catalog?.exam || [];
  const [examId, setExamId] = useState(initialExam === "jamb" ? "jamb" : "waec");
  const exam = exams.find((e) => e.id === examId);
  const [packageCode, setPackageCode] = useState("");
  const [profile, setProfile] = useState("");
  const [phone, setPhone] = useState(user?.phone ? String(user.phone).replace(/^\+234/, "0") : "");
  const [phoneError, setPhoneError] = useState("");

  const available = Boolean(exam && exam.packages.length);
  const pkg = exam ? exam.packages.find((p) => p.code === packageCode) || (exam.packages.length === 1 ? exam.packages[0] : null) : null;
  const isJamb = examId === "jamb";
  const check = useAccountCheck({ service: "exam", provider: "jamb", account: profile, minLength: 10, enabled: isJamb && available });
  const order = useBillOrder(pkg ? pkg.price : NaN, "exam");
  const ready = Boolean(available && pkg && (!isJamb || check.status === "ok"));

  const buy = () => {
    const ph = validateNigerianPhone(phone);
    if (!ph.valid) {
      setPhoneError(ph.message);
      return;
    }
    if (!ready) {
      order.setError(isJamb && check.status !== "ok" ? "Enter a valid JAMB Profile ID first." : "Choose a PIN.");
      return;
    }
    order.submit({ service: "exam", provider: examId, packageCode: pkg.code, account: isJamb ? check.digits : undefined, phone: phone.trim() });
  };

  if (!catalog) return <CatalogState loading={loading} error={error} onRetry={reload} />;

  let n = 1;
  return (
    <BillCheckout
      step={isJamb ? 4 : 3}
      amount={pkg ? pkg.price : NaN}
      cardFee={catalog.cardFee}
      order={order}
      onBuy={buy}
      ready={ready}
      buyLabel="Buy PIN ·"
      title={pkg ? pkg.name : `${exam?.name || "Exam"} PIN`}
      subtitle={isJamb && check.status === "ok" ? check.name : "PIN shown here and emailed"}
      rows={[
        { label: "Exam", value: exam?.name, icon: GraduationCap },
        ...(isJamb ? [{ label: "Profile ID", value: check.status === "ok" ? `${check.digits} · ${check.name}` : profile, icon: UserRound }] : []),
        { label: "PIN", value: pkg?.name, icon: KeyRound },
        { label: "Phone", value: phone, icon: Smartphone },
      ]}
    >
      <Step n={n++} id="exam-type" title="Exam">
        <ChoiceGrid
          label="Exam"
          cols="grid-cols-2"
          options={exams.map((e) => ({
            value: e.id,
            title: e.name,
            detail: e.packages.length ? `From ${formatNaira(Math.min(...e.packages.map((p) => p.price)))}` : "Not available right now",
          }))}
          value={examId}
          onChange={(v) => {
            setExamId(v);
            setPackageCode("");
          }}
        />
      </Step>

      {!available ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <Clock size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{exam?.name || "These"} PINs aren&apos;t available right now. Please check back soon.</span>
        </div>
      ) : (
        <>
          <Step n={n++} id="exam-pin" title="PIN type">
            <ChoiceGrid
              label="PIN type"
              cols="grid-cols-1 sm:grid-cols-2"
              options={exam.packages.map((p) => ({ value: p.code, title: p.name, detail: formatNaira(p.price) }))}
              value={pkg?.code}
              onChange={setPackageCode}
            />
          </Step>

          {isJamb && (
            <Step n={n++} id="exam-profile" title="JAMB Profile ID">
              <AccountField
                id="jamb-profile"
                label="JAMB Profile ID"
                placeholder="e.g. 1234567890"
                value={profile}
                onChange={setProfile}
                check={check}
                hint="The Profile Code JAMB sent you by SMS when you created your profile."
              />
            </Step>
          )}

          <PhoneField id="exam-phone" value={phone} onChange={(v) => { setPhone(v); setPhoneError(""); }} error={phoneError} />
        </>
      )}
    </BillCheckout>
  );
}
