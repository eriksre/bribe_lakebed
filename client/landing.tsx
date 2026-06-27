import { Link } from "lakebed/client";
import type { ComponentChildren } from "preact";
import { createContext } from "preact";
import { useContext } from "preact/hooks";
import type { Campaign, LandingPageSettings, LandingPageTargetType } from "../shared/domain";
import { ButtonLink, EmptyState } from "./ui";

type LandingDefaults = {
  eyebrow: string;
  title: string;
  description: string;
};

type LandingTheme = {
  accentColor: string;
  cardColor: string;
};

const defaultTheme: LandingTheme = {
  accentColor: "",
  cardColor: "",
};

const LandingThemeContext = createContext<LandingTheme>(defaultTheme);

export function LandingShell({
  children,
  defaults,
  editTarget,
  settings,
}: {
  children: ComponentChildren;
  defaults: LandingDefaults;
  editTarget?: { type: LandingPageTargetType; id: string; returnPath: string };
  settings?: LandingPageSettings | null;
}) {
  const copy = {
    eyebrow: settings?.eyebrow || defaults.eyebrow,
    title: settings?.title || defaults.title,
    description: settings?.description || defaults.description,
  };
  const theme = {
    accentColor: safeCssColor(settings?.accentColor),
    cardColor: safeCssColor(settings?.cardColor),
  };
  const textColor = safeCssColor(settings?.textColor);
  const style = {
    backgroundColor: safeCssColor(settings?.backgroundColor) || undefined,
    backgroundImage: settings?.backgroundImageUrl ? `url(${settings.backgroundImageUrl})` : undefined,
    backgroundPosition: "center top",
    backgroundSize: "cover",
    color: textColor || undefined,
  };
  const returnPath = editTarget ? encodeURIComponent(editTarget.returnPath) : "";

  return (
    <LandingThemeContext.Provider value={theme}>
      <main className="bribe-app-theme min-h-screen bg-neutral-100 text-neutral-950">
        <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col border-x bg-white shadow-sm" style={style}>
          {editTarget ? (
            <section className="border-b bg-white px-4 py-3" style={landingSurfaceStyle(theme, 0.96)}>
              <ButtonLink href={`/owner/landing/${editTarget.type}/${editTarget.id}/edit?returnPath=${returnPath}`} variant="secondary">Edit landing page</ButtonLink>
            </section>
          ) : null}
          <header className="border-b bg-white px-5 py-6" style={landingSurfaceStyle(theme, 0.96)}>
            <Link className={`text-sm font-medium opacity-80 hover:opacity-100 ${theme.accentColor ? "" : "text-neutral-500 hover:text-neutral-950"}`} style={accentTextStyle(theme)} to="/">{copy.eyebrow}</Link>
            {settings?.foregroundImageUrl ? (
              <img className="bribe-image mt-4 aspect-video w-full rounded-lg object-cover" alt="" src={settings.foregroundImageUrl} />
            ) : null}
            <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight">{copy.title}</h1>
            <p className="mt-2 text-pretty text-sm leading-6 opacity-75">{copy.description}</p>
          </header>
          <div className="min-w-0 flex-1 px-5 py-5">{children}</div>
        </div>
      </main>
    </LandingThemeContext.Provider>
  );
}

export function CampaignTaskList({
  campaigns,
  hrefFor,
  title = "Tasks available now",
}: {
  campaigns: Campaign[];
  hrefFor: (campaign: Campaign) => string;
  title?: string;
}) {
  const theme = useContext(LandingThemeContext);
  return (
    <section className="bribe-surface rounded-xl border bg-white" style={landingSurfaceStyle(theme)}>
      <header className="border-b p-4" style={accentBorderStyle(theme)}>
        <h2 className="text-balance text-base font-semibold">{title}</h2>
      </header>
      <div className="p-4">
        {campaigns.length ? (
          <div className="grid gap-3">
            {campaigns.map((campaign, index) => (
              <article className="bribe-surface rounded-lg border bg-white" style={landingSurfaceStyle(theme)} key={campaign.id}>
                <div className="p-3">
                  <p className={`text-xs font-medium uppercase opacity-65 ${theme.accentColor ? "" : "text-neutral-500"}`} style={accentTextStyle(theme)}>Task {index + 1}</p>
                  <h2 className="mt-1 text-balance text-lg font-semibold leading-6">{campaign.title}</h2>
                  <p className="mt-2 text-pretty text-sm leading-5 opacity-75">{campaign.challengePrompt}</p>
                </div>
                <div className="grid gap-3 border-t bg-neutral-50 p-3" style={accentPanelStyle(theme)}>
                  <div>
                    <p className={`text-xs font-medium uppercase opacity-65 ${theme.accentColor ? "" : "text-neutral-500"}`} style={accentTextStyle(theme)}>Reward</p>
                    <p className="mt-1 font-medium">{campaign.rewardLabel}</p>
                  </div>
                  <Link
                    className={theme.accentColor ? "bribe-button inline-flex h-10 items-center justify-center rounded-md border px-3.5 text-sm font-medium" : "bribe-button inline-flex h-10 items-center justify-center rounded-md border border-neutral-900 bg-neutral-950 px-3.5 text-sm font-medium text-white shadow-sm hover:bg-neutral-800"}
                    style={accentButtonStyle(theme)}
                    to={hrefFor(campaign)}
                  >
                    Choose task
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState text="New tasks will appear here when the business makes them available." />
        )}
      </div>
    </section>
  );
}

function safeCssColor(value?: string): string {
  const color = value?.trim() ?? "";
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : "";
}

function withAlpha(color: string, alpha: number): string {
  const normalized = safeCssColor(color);
  if (!normalized) {
    return "";
  }
  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function landingSurfaceStyle(theme: LandingTheme, alpha?: number) {
  return {
    backgroundColor: theme.cardColor ? (alpha ? withAlpha(theme.cardColor, alpha) : theme.cardColor) : undefined,
    borderColor: theme.accentColor || undefined,
  };
}

function accentBorderStyle(theme: LandingTheme) {
  return {
    borderColor: theme.accentColor || undefined,
  };
}

function accentTextStyle(theme: LandingTheme) {
  return {
    color: theme.accentColor || undefined,
  };
}

function accentPanelStyle(theme: LandingTheme) {
  return {
    backgroundColor: theme.accentColor ? withAlpha(theme.accentColor, 0.08) : undefined,
    borderColor: theme.accentColor || undefined,
  };
}

function accentButtonStyle(theme: LandingTheme) {
  return theme.accentColor
    ? {
        backgroundColor: theme.accentColor,
        borderColor: theme.accentColor,
        color: contrastText(theme.accentColor),
      }
    : undefined;
}

function contrastText(color: string): string {
  const normalized = safeCssColor(color) || "#171717";
  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);
  return red * 0.299 + green * 0.587 + blue * 0.114 > 150 ? "#111111" : "#ffffff";
}
