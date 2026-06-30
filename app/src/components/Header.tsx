import { useAuth } from "../auth/useAuth";
import { useCampaign } from "../state/campaign";
import { useTheme } from "../lib/useTheme";
import { initials } from "../lib/validation";
import { ClockIcon, GearIcon, LogoutIcon, MoonIcon, SunIcon } from "./icons";
import { HeiMailerLogo } from "./Brand";

export default function Header({
  onOpenHistory,
  onOpenSettings,
}: {
  onOpenHistory: () => void;
  onOpenSettings: () => void;
}) {
  const { user, signOut, isReal } = useAuth();
  const { history } = useCampaign();
  const { theme, toggle } = useTheme();

  return (
    <header className="header">
      <div className="header__inner">
        <div className="brand">
          <HeiMailerLogo size={38} animated={false} />
          <span className="brand__title">
            HeiMailer
            <small>HEINEKEN Myanmar</small>
          </span>
        </div>

        <div className="header__spacer" />

        <button
          className="iconbtn"
          onClick={toggle}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <SunIcon size={18} /> : <MoonIcon size={18} />}
        </button>

        {user && (
          <>
            <button
              className="iconbtn iconbtn--badge"
              data-count={history.length}
              onClick={onOpenHistory}
              title="Send history"
            >
              <ClockIcon />
            </button>
            <button className="iconbtn" onClick={onOpenSettings} title="Settings">
              <GearIcon />
            </button>

            <div className="identity" title={`Sending as ${user.email}`}>
              <span className="avatar">{initials(user.name)}</span>
              <span className="identity__meta">
                <span className="identity__name">
                  {user.name}
                  <span
                    className={`mode-dot ${isReal ? "mode-dot--live" : "mode-dot--demo"}`}
                    title={isReal ? "Live - real sending" : "Demo - simulated"}
                  />
                </span>
                <span className="identity__mail">{user.email}</span>
              </span>
            </div>
            <button className="btn btn--subtle" onClick={signOut} title="Sign out">
              <LogoutIcon />
            </button>
          </>
        )}
      </div>
    </header>
  );
}
