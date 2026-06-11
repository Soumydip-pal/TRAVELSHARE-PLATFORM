import React, { useState } from "react";
import { updateProfile } from "../utils/api";
import { useAuth } from "../utils/AuthContext";
import { useToast } from "../utils/ToastContext";

export default function Profile() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    city: user?.city || "Kolkata",
    emergencyName: user?.emergencyContact?.name || "",
    emergencyPhone: user?.emergencyContact?.phone || "",
  });
  const [saving, setSaving] = useState(false);

  const hc = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await updateProfile({
        name: form.name,
        phone: form.phone,
        city: form.city,
        emergencyContact: { name: form.emergencyName, phone: form.emergencyPhone },
        trustedContacts: form.emergencyName ? [{ name: form.emergencyName, phone: form.emergencyPhone, relation: "Emergency" }] : [],
      });
      setUser(r.data.user);
      toast?.show("Profile updated", "success");
    } catch {
      toast?.show("Could not update profile", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 20px" }}>
      <h2 className="page-title">My Profile</h2>

      <div className="prof-hdr">
        <div className="avatar" style={{ width: 72, height: 72, fontSize: 28 }}>{user?.name?.[0]?.toUpperCase()}</div>
        <div>
          <div className="prof-name">{user?.name}</div>
          <div className="text-muted text-sm">{user?.email}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <span className="badge badge-green">Trust {user?.trustScore?.score || 82}</span>
            <span className="badge badge-blue">{user?.gender}</span>
            <span className="badge badge-gray">{user?.city}</span>
            <span className="badge badge-orange">Wallet Rs {user?.wallet?.balance || 0}</span>
          </div>
        </div>
      </div>

      <div className="prof-form">
        <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, marginBottom: 16 }}>Edit Profile</h3>
        <form onSubmit={handleSave}>
          <div className="form-row">
            <div className="form-group"><label>Full Name</label><input name="name" value={form.name} onChange={hc} /></div>
            <div className="form-group"><label>Phone</label><input name="phone" value={form.phone} onChange={hc} /></div>
          </div>
          <div className="form-group"><label>City</label>
            <select name="city" value={form.city} onChange={hc}>
              {["Kolkata", "Delhi", "Mumbai", "Bengaluru"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div className="divider" />
          <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Emergency Contact</h3>
          <div className="form-row">
            <div className="form-group"><label>Contact Name</label><input name="emergencyName" placeholder="Trusted person's name" value={form.emergencyName} onChange={hc} /></div>
            <div className="form-group"><label>Contact Phone</label><input name="emergencyPhone" placeholder="+91 XXXXXXXXXX" value={form.emergencyPhone} onChange={hc} /></div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ padding: "11px 24px" }} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </div>

      <div className="safety-card">
        <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, marginBottom: 16 }}>Safety Comfort</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 14, color: "var(--text2)" }}>
          {["Verify the co-traveler profile before sharing a ride.",
            "Keep emergency contact and trusted contact details updated.",
            "Share route details when comfort mode is active.",
            "Check notifications for ride updates and confirmations."].map((t) => <div key={t}>{t}</div>)}
        </div>
      </div>
    </div>
  );
}
