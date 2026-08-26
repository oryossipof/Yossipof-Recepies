import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, LogOut, Moon, Sun } from "lucide-react";

import {
  signOut,
  updatePassword,
  useAuth,
  verifyCurrentPassword,
} from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { uploadAvatar } from "@/lib/images";
import { applyTheme, readTheme, writeTheme, type Theme } from "@/lib/theme";
import { Avatar } from "@/components/Avatar";
import { Notice } from "@/components/Notice";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

/** Name, picture, password and theme — everything about the account. */
export function ProfileScreen() {
  const { user } = useAuth();
  const { profile, loading, save } = useProfile();

  const [name, setName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordChanged, setPasswordChanged] = useState(false);

  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    if (profile) setName(profile.display_name ?? "");
  }, [profile]);

  async function saveName() {
    setSavingProfile(true);
    setProfileError(null);
    setProfileSaved(false);
    try {
      await save({ display_name: name.trim() });
      setProfileSaved(true);
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : "שמירת הפרטים נכשלה");
    } finally {
      setSavingProfile(false);
    }
  }

  async function pickAvatar(file: File | undefined) {
    if (!file || !user) return;
    setUploading(true);
    setProfileError(null);
    setProfileSaved(false);
    try {
      await save({ avatar_url: await uploadAvatar(user.id, file) });
      setProfileSaved(true);
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : "העלאת התמונה נכשלה");
    } finally {
      setUploading(false);
      if (avatarInput.current) avatarInput.current.value = "";
    }
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError("הסיסמאות החדשות אינן זהות");
      return;
    }
    if (!user?.email) return;

    setChangingPassword(true);
    setPasswordError(null);
    setPasswordChanged(false);
    try {
      await verifyCurrentPassword(user.email, currentPassword);
      await updatePassword(newPassword);
      setPasswordChanged(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e) {
      setPasswordError(e instanceof Error ? e.message : "החלפת הסיסמה נכשלה");
    } finally {
      setChangingPassword(false);
    }
  }

  function switchTheme(next: Theme) {
    setTheme(next);
    writeTheme(next);
    applyTheme(next);
  }

  return (
    <div className="min-h-dvh pb-12">
      <ScreenHeader title="הגדרות משתמש" />

      <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8 sm:px-6">
        <section className="space-y-4 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-4">
            <Avatar name={name || user?.email} url={profile?.avatar_url} size="lg" />
            <div className="space-y-2">
              <input
                ref={avatarInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void pickAvatar(e.target.files?.[0])}
              />
              <Button
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => avatarInput.current?.click()}
              >
                {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
                {uploading ? "מעלה…" : "החלפת תמונה"}
              </Button>
              <p className="text-xs text-muted-foreground" dir="ltr">
                {user?.email}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="display-name">שם</Label>
            <Input
              id="display-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              placeholder="השם שיוצג ליד המתכונים שלכם"
            />
          </div>

          {profileError && <Notice kind="error">{profileError}</Notice>}
          {profileSaved && <Notice kind="success">הפרטים נשמרו.</Notice>}

          <Button onClick={() => void saveName()} disabled={savingProfile || loading}>
            {savingProfile && <Loader2 className="animate-spin" />}
            שמירה
          </Button>
        </section>

        <form
          onSubmit={changePassword}
          className="space-y-4 rounded-xl border border-border bg-card p-4"
        >
          <h2 className="text-base font-semibold">החלפת סיסמה</h2>

          <div className="space-y-1.5">
            <Label htmlFor="current-password">סיסמה נוכחית</Label>
            <Input
              id="current-password"
              type="password"
              dir="ltr"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="next-password">סיסמה חדשה</Label>
            <Input
              id="next-password"
              type="password"
              dir="ltr"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-new-password">אישור סיסמה חדשה</Label>
            <Input
              id="confirm-new-password"
              type="password"
              dir="ltr"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>

          {passwordError && <Notice kind="error">{passwordError}</Notice>}
          {passwordChanged && <Notice kind="success">הסיסמה הוחלפה.</Notice>}

          <Button type="submit" disabled={changingPassword}>
            {changingPassword && <Loader2 className="animate-spin" />}
            החלפת סיסמה
          </Button>
        </form>

        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
          <h2 className="text-base font-semibold">תצוגה</h2>
          <div className="flex gap-2">
            <Button
              variant={theme === "light" ? "default" : "outline"}
              size="sm"
              onClick={() => switchTheme("light")}
            >
              <Sun />
              בהיר
            </Button>
            <Button
              variant={theme === "dark" ? "default" : "outline"}
              size="sm"
              onClick={() => switchTheme("dark")}
            >
              <Moon />
              כהה
            </Button>
          </div>
        </section>

        <Separator />

        <Button variant="outline" onClick={() => void signOut()}>
          <LogOut />
          התנתקות
        </Button>
      </main>
    </div>
  );
}
