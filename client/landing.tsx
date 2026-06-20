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
  accentColor: "#171717",
  cardColor: "#ffffff",
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
    accentColor: safeCssColor(settings?.accentColor) || defaultTheme.accentColor,
    cardColor: safeCssColor(settings?.cardColor) || defaultTheme.cardColor,
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
      <main className="min-h-screen bg-neutral-100 text-neutral-950">
        <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col border-x bg-white shadow-sm" style={style}>
          {editTarget ? (
            <section className="border-b px-4 py-3" style={{ backgroundColor: withAlpha(theme.cardColor, 0.96), borderColor: theme.accentColor }}>
              <ButtonLink href={`/owner/landing/${editTarget.type}/${editTarget.id}/edit?returnPath=${returnPath}`} variant="secondary">Edit landing page</ButtonLink>
            </section>
          ) : null}
          <header className="border-b px-4 py-5" style={{ backgroundColor: withAlpha(theme.cardColor, 0.96), borderColor: theme.accentColor }}>
            <Link className="text-sm font-medium opacity-80 hover:opacity-100" style={{ color: theme.accentColor }} to="/">{copy.eyebrow}</Link>
            {settings?.foregroundImageUrl ? (
              <img className="mt-4 aspect-video w-full rounded-lg object-cover" alt="" src={settings.foregroundImageUrl} />
            ) : null}
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">{copy.title}</h1>
            <p className="mt-2 text-sm leading-6 opacity-75">{copy.description}</p>
          </header>
          <div className="min-w-0 flex-1 px-4 py-4">{children}</div>
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
    <section className="rounded-lg border" style={{ backgroundColor: theme.cardColor, borderColor: theme.accentColor }}>
      <header className="border-b p-4" style={{ borderColor: theme.accentColor }}>
        <h2 className="text-base font-semibold">{title}</h2>
      </header>
      <div className="p-4">
        {campaigns.length ? (
          <div className="grid gap-3">
            {campaigns.map((campaign, index) => (
              <article className="rounded-lg border" style={{ backgroundColor: theme.cardColor, borderColor: theme.accentColor }} key={campaign.id}>
                <div className="p-3">
                  <p className="text-xs font-medium uppercase opacity-65" style={{ color: theme.accentColor }}>Task {index + 1}</p>
                  <h2 className="mt-1 text-lg font-semibold leading-6">{campaign.title}</h2>
                  <p className="mt-2 text-sm leading-5 opacity-75">{campaign.challengePrompt}</p>
                </div>
                <div className="grid gap-3 border-t p-3" style={{ backgroundColor: withAlpha(theme.accentColor, 0.08), borderColor: theme.accentColor }}>
                  <div>
                    <p className="text-xs font-medium uppercase opacity-65" style={{ color: theme.accentColor }}>Reward</p>
                    <p className="mt-1 font-medium">{campaign.rewardLabel}</p>
                  </div>
                  <Link
                    className="inline-flex h-9 items-center justify-center rounded-md border px-3 text-sm font-medium"
                    style={{ backgroundColor: theme.accentColor, borderColor: theme.accentColor, color: contrastText(theme.accentColor) }}
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

function contrastText(color: string): string {
  const normalized = safeCssColor(color) || defaultTheme.accentColor;
  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);
  return red * 0.299 + green * 0.587 + blue * 0.114 > 150 ? "#111111" : "#ffffff";
}
