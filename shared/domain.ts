export type CampaignStatus = "draft" | "active" | "paused" | "ended";
export type QrCodeStatus = "active" | "paused" | "archived";
export type QrDotStyle = "rounded" | "dots" | "classy" | "square";
export type QrCornerStyle = "extra-rounded" | "rounded" | "square";
export type SubmissionStatus = "uploaded" | "approved" | "rejected" | "needs_review";
export type RewardStatus = "issued" | "redeemed" | "expired" | "void";
export type SocialPostStatus = "draft" | "approved" | "posted" | "rejected";
export type LandingPageTargetType = "venue" | "campaign" | "qr_code";

export type Venue = {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  captionTone: string;
  hashtags: string;
  requireApproval: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Campaign = {
  id: string;
  ownerId: string;
  venueId: string;
  slug: string;
  title: string;
  challengePrompt: string;
  rewardLabel: string;
  budgetCents: string;
  maxRedemptions: string;
  validationThreshold: string;
  status: CampaignStatus;
  createdAt: string;
  updatedAt: string;
};

export type QrCode = {
  id: string;
  ownerId: string;
  venueId: string;
  publicId: string;
  name: string;
  description: string;
  status: QrCodeStatus;
  campaignIds: string;
  foregroundColor: string;
  backgroundColor: string;
  accentColor: string;
  dotStyle: QrDotStyle;
  cornerStyle: QrCornerStyle;
  logoImageUrl: string;
  logoSize: string;
  createdAt: string;
  updatedAt: string;
};

export type LandingPageSettings = {
  id: string;
  ownerId: string;
  targetType: LandingPageTargetType;
  targetId: string;
  eyebrow: string;
  title: string;
  description: string;
  backgroundImageUrl: string;
  foregroundImageUrl: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  cardColor: string;
  createdAt: string;
  updatedAt: string;
};

export type Submission = {
  id: string;
  ownerId: string;
  venueId: string;
  campaignId: string;
  clientToken: string;
  patronName: string;
  mediaDataUrl: string;
  mediaName: string;
  mediaMime: string;
  mediaType: "image" | "video";
  qrPublicId: string;
  status: SubmissionStatus;
  qualityScore: string;
  taskMatchScore: string;
  safetyScore: string;
  decisionReason: string;
  validationJson: string;
  rewardCode: string;
  hasConsent: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Reward = {
  id: string;
  ownerId: string;
  venueId: string;
  campaignId: string;
  submissionId: string;
  code: string;
  label: string;
  status: RewardStatus;
  expiresAt: string;
  redeemedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type SocialPost = {
  id: string;
  ownerId: string;
  venueId: string;
  campaignId: string;
  submissionId: string;
  description: string;
  caption: string;
  channelsJson: string;
  status: SocialPostStatus;
  ownerNote: string;
  approvedAt: string;
  postedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type OwnerAuthSummary = {
  userId: string;
  displayName: string;
  email: string;
  picture: string;
  isGuest: boolean;
};

export type OwnerSnapshot = {
  auth: OwnerAuthSummary;
  venue: Venue | null;
  campaigns: Campaign[];
  qrCodes: QrCode[];
  landingSettings: LandingPageSettings[];
  submissions: Submission[];
  rewards: Reward[];
  socialPosts: SocialPost[];
};

export type PublicSnapshot = {
  venues: Venue[];
  campaigns: Campaign[];
  qrCodes: QrCode[];
  landingSettings: LandingPageSettings[];
  submissions: [];
  rewards: PublicReward[];
};

export type CampaignInput = {
  title: string;
  challengePrompt: string;
  rewardLabel: string;
  budget: string;
  maxRedemptions: string;
  validationThreshold: string;
  status: CampaignStatus;
};

export type QrInput = {
  name: string;
  description: string;
  status: QrCodeStatus;
  campaignIds: string[];
  foregroundColor: string;
  backgroundColor: string;
  accentColor: string;
  dotStyle: QrDotStyle;
  cornerStyle: QrCornerStyle;
  logoImageUrl: string;
  logoSize: string;
};

export type LandingSettingsInput = {
  targetType: LandingPageTargetType;
  targetId: string;
  eyebrow: string;
  title: string;
  description: string;
  backgroundImageUrl: string;
  foregroundImageUrl: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  cardColor: string;
};

export type SubmissionInput = {
  campaignId: string;
  patronName: string;
  mediaDataUrl: string;
  mediaName: string;
  mediaMime: string;
  qrPublicId: string;
  hasConsent: boolean;
  clientToken: string;
};

export type SubmissionResult = {
  ok: boolean;
  submissionId: string;
  rewardCode: string;
  status: SubmissionStatus;
  message: string;
};

export type RewardLookupResult = {
  ok: boolean;
  reward: Reward | null;
  venueName: string;
  message: string;
};

export type PublicReward = Pick<Reward, "code" | "label" | "status" | "expiresAt">;

export type PublicRewardLookupResult = {
  ok: boolean;
  reward: PublicReward | null;
  venueName: string;
  message: string;
};

export type PublicSubmissionStatus = {
  ok: boolean;
  submission: Pick<
    Submission,
    "id" | "campaignId" | "mediaDataUrl" | "status" | "decisionReason" | "rewardCode"
  > | null;
  message: string;
};

export const DEFAULT_VENUE_NAME = "Your Venue";
export const DEFAULT_VENUE_SLUG = "your-venue";
export const DEFAULT_HASHTAGS = "#BribeCafe #CafeVibes #LocalCoffee";
export const EMPTY_ID_LIST = "";
export const DEFAULT_QR_FOREGROUND_COLOR = "#111827";
export const DEFAULT_QR_BACKGROUND_COLOR = "#ffffff";
export const DEFAULT_QR_ACCENT_COLOR = "#ef4444";
export const DEFAULT_QR_DOT_STYLE: QrDotStyle = "rounded";
export const DEFAULT_QR_CORNER_STYLE: QrCornerStyle = "extra-rounded";
export const DEFAULT_QR_LOGO_SIZE = "20";

export function cleanText(value: string, limit = 160): string {
  return value.replace(/\s+/g, " ").trim().slice(0, limit);
}

export function cleanLongText(value: string, limit = 1200): string {
  return value.replace(/\s+\n/g, "\n").replace(/[ \t]+/g, " ").trim().slice(0, limit);
}

export function slugify(value: string, fallback = "item"): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || fallback;
}

export function splitIds(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function joinIds(ids: string[]): string {
  const unique: string[] = [];
  for (const id of ids) {
    if (id && !unique.includes(id)) {
      unique.push(id);
    }
  }
  return unique.join(",");
}

export function statusLabel(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function numberText(value: string, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function integerText(value: string, fallback = 0): number {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function dollarsToCentsText(value: string): string {
  const dollars = Number(value.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(dollars) || dollars <= 0) {
    return "";
  }
  return String(Math.round(dollars * 100));
}

export function centsToDollarLabel(value: string): string {
  const cents = integerText(value, 0);
  if (!cents) {
    return "-";
  }
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

export function limitLabel(value: string): string {
  const limit = integerText(value, 0);
  return limit > 0 ? String(limit) : "No cap";
}

export function progressPercent(value: number, max: number): number {
  if (!Number.isFinite(max) || max <= 0) {
    return 0;
  }
  return clamp((value / max) * 100, 0, 100);
}

export function averageScore(values: string[]): string {
  const scores = values.map((value) => integerText(value, 0)).filter((value) => value > 0);
  if (!scores.length) {
    return "-";
  }
  return String(Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length));
}

export function safeColor(value: string): string {
  const trimmed = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : "";
}

export function sortNewest<T extends { createdAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function formatDate(value: string): string {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

export function makeClientToken(): string {
  return `client_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
