import { splitIds } from "../shared/domain";
import type { Campaign, LandingPageTargetType, OwnerSnapshot, PublicReward, PublicSnapshot, QrCode } from "../shared/domain";

export function matchPublicPath(path: string, publicData: PublicSnapshot) {
  const parts = path.split("/").filter(Boolean);
  if (!parts.length) {
    return { type: "none" as const };
  }
  const venue = publicData.venues.find((item) => item.slug === parts[0]);
  if (!venue) {
    return { type: "none" as const };
  }
  if (!parts[1]) {
    return { type: "venue" as const, venue };
  }
  const campaign = publicData.campaigns.find((item) => item.venueId === venue.id && item.slug === parts[1] && item.status === "active");
  return campaign ? { type: "campaign" as const, venue, campaign } : { type: "none" as const };
}

export function activeCampaignsForQr(publicData: PublicSnapshot, qrCode: QrCode): Campaign[] {
  const ids = splitIds(qrCode.campaignIds);
  return ids
    .map((id) => publicData.campaigns.find((campaign) => campaign.id === id && campaign.status === "active"))
    .filter((campaign): campaign is Campaign => Boolean(campaign));
}

export function publicQrForCampaign(publicData: PublicSnapshot, campaign: Campaign): QrCode | null {
  return publicData.qrCodes.find((qrCode) =>
    qrCode.status === "active" &&
    qrCode.venueId === campaign.venueId &&
    splitIds(qrCode.campaignIds).includes(campaign.id)
  ) ?? null;
}

export function settingFor(publicData: PublicSnapshot | OwnerSnapshot, targetType: LandingPageTargetType, targetId: string) {
  const settings = "landingSettings" in publicData ? publicData.landingSettings : [];
  return settings.find((item) => item.targetType === targetType && item.targetId === targetId) ?? null;
}

export function getLandingTarget(ownerData: OwnerSnapshot, targetType: LandingPageTargetType, targetId: string) {
  const venue = ownerData.venue;
  if (!venue) return null;
  if (targetType === "venue" && targetId === venue.id) {
    return {
      label: venue.name,
      defaults: { eyebrow: "Bribe", title: venue.name, description: "Choose a reward task, then upload your submission for review." },
    };
  }
  if (targetType === "campaign") {
    const campaign = ownerData.campaigns.find((item) => item.id === targetId);
    return campaign
      ? { label: campaign.title, defaults: { eyebrow: venue.name, title: campaign.title, description: `${venue.name} reward submission.` } }
      : null;
  }
  const qrCode = ownerData.qrCodes.find((item) => item.id === targetId);
  return qrCode
    ? { label: qrCode.name, defaults: { eyebrow: venue.name, title: `${venue.name} tasks`, description: "Pick the photo task you want to complete, then upload your submission for the matching reward." } }
    : null;
}

export function findPublicReward(_publicData: PublicSnapshot, _code: string): PublicReward | null {
  const normalized = _code.trim().toUpperCase();
  return _publicData.rewards.find((reward) => reward.code === normalized) ?? null;
}
