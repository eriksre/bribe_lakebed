import { boolean, capsule, endpoint, mutation, query, string, table, text } from "lakebed/server";
import {
  DEFAULT_HASHTAGS,
  DEFAULT_QR_ACCENT_COLOR,
  DEFAULT_QR_BACKGROUND_COLOR,
  DEFAULT_QR_CORNER_STYLE,
  DEFAULT_QR_DOT_STYLE,
  DEFAULT_QR_FOREGROUND_COLOR,
  DEFAULT_QR_LOGO_SIZE,
  DEFAULT_VENUE_NAME,
  DEFAULT_VENUE_SLUG,
  cleanLongText,
  cleanText,
  clamp,
  dollarsToCentsText,
  integerText,
  joinIds,
  safeColor,
  slugify,
  sortNewest,
  splitIds,
} from "../shared/domain";
import type {
  Campaign,
  CampaignInput,
  CampaignStatus,
  LandingPageSettings,
  LandingPageTargetType,
  LandingSettingsInput,
  OwnerAuthSummary,
  OwnerSnapshot,
  PublicReward,
  PublicRewardLookupResult,
  PublicSnapshot,
  PublicSubmissionStatus,
  QrCode,
  QrCornerStyle,
  QrDotStyle,
  QrCodeStatus,
  QrInput,
  Reward,
  RewardLookupResult,
  SocialPost,
  Submission,
  SubmissionInput,
  SubmissionResult,
  SubmissionStatus,
  Venue,
} from "../shared/domain";

type DbContext = {
  db: any;
  auth: {
    userId: string;
    displayName?: string;
    email?: string;
    picture?: string;
    isGuest?: boolean;
  };
};

const REWARD_BUDGET_UNIT_CENTS = 100;

export default capsule({
  name: "bribe",

  schema: {
    venues: table({
      ownerId: string(),
      name: string(),
      slug: string(),
      captionTone: string().default("warm"),
      hashtags: string().default(DEFAULT_HASHTAGS),
      requireApproval: boolean().default(true),
    }),

    campaigns: table({
      ownerId: string(),
      venueId: string(),
      slug: string(),
      title: string(),
      challengePrompt: string(),
      rewardLabel: string(),
      budgetCents: string().default(""),
      maxRedemptions: string().default(""),
      validationThreshold: string().default("70"),
      status: string().default("active"),
    }),

    qrCodes: table({
      ownerId: string(),
      venueId: string(),
      publicId: string(),
      name: string(),
      description: string().default(""),
      status: string().default("active"),
      campaignIds: string().default(""),
      foregroundColor: string().default(DEFAULT_QR_FOREGROUND_COLOR),
      backgroundColor: string().default(DEFAULT_QR_BACKGROUND_COLOR),
      accentColor: string().default(DEFAULT_QR_ACCENT_COLOR),
      dotStyle: string().default(DEFAULT_QR_DOT_STYLE),
      cornerStyle: string().default(DEFAULT_QR_CORNER_STYLE),
      logoImageUrl: string().default(""),
      logoSize: string().default(DEFAULT_QR_LOGO_SIZE),
    }),

    landingPageSettings: table({
      ownerId: string(),
      targetType: string(),
      targetId: string(),
      eyebrow: string().default(""),
      title: string().default(""),
      description: string().default(""),
      backgroundImageUrl: string().default(""),
      foregroundImageUrl: string().default(""),
      backgroundColor: string().default(""),
      textColor: string().default(""),
      accentColor: string().default(""),
      cardColor: string().default(""),
    }),

    submissions: table({
      ownerId: string(),
      venueId: string(),
      campaignId: string(),
      clientToken: string(),
      patronName: string().default(""),
      mediaDataUrl: string().default(""),
      mediaName: string().default(""),
      mediaMime: string().default(""),
      mediaType: string().default("image"),
      qrPublicId: string().default(""),
      status: string().default("uploaded"),
      qualityScore: string().default(""),
      taskMatchScore: string().default(""),
      safetyScore: string().default(""),
      decisionReason: string().default(""),
      validationJson: string().default(""),
      rewardCode: string().default(""),
      hasConsent: boolean().default(false),
    }),

    rewards: table({
      ownerId: string(),
      venueId: string(),
      campaignId: string(),
      submissionId: string(),
      code: string(),
      label: string(),
      status: string().default("issued"),
      expiresAt: string().default(""),
      redeemedAt: string().default(""),
    }),

    socialPosts: table({
      ownerId: string(),
      venueId: string(),
      campaignId: string(),
      submissionId: string(),
      description: string().default(""),
      caption: string(),
      channelsJson: string().default("[\"instagram\",\"tiktok\",\"facebook\"]"),
      status: string().default("draft"),
      ownerNote: string().default(""),
      approvedAt: string().default(""),
      postedAt: string().default(""),
    }),
  },

  queries: {
    ownerSnapshot: query((ctx: DbContext): OwnerSnapshot => getOwnerSnapshot(ctx)),

    publicSnapshot: query((ctx: DbContext): PublicSnapshot => getPublicSnapshot(ctx)),

    rewardLookup: query((ctx: DbContext): RewardLookupResult => lookupReward(ctx, "")),
  },

  mutations: {
    ensureWorkspace: mutation((ctx: DbContext): OwnerSnapshot => {
      const venue = ensureVenue(ctx);
      ensureDefaultQrCode(ctx, venue);
      return getOwnerSnapshot(ctx);
    }),

    createCampaign: mutation((ctx: DbContext, input: CampaignInput): Campaign => {
      const venue = ensureVenue(ctx);
      const normalized = normalizeCampaignInput(input);
      const slug = uniqueCampaignSlug(ctx, venue.id, normalized.title, "");
      const campaign = insertAndRead<Campaign>(ctx.db.campaigns, {
        ownerId: ctx.auth.userId,
        venueId: venue.id,
        slug,
        ...normalized,
      });

      attachCampaignToDefaultQr(ctx, venue.id, campaign.id);
      return campaign;
    }),

    updateCampaign: mutation((ctx: DbContext, id: string, input: CampaignInput): Campaign | null => {
      const campaign = requireOwnedCampaign(ctx, id);
      const normalized = normalizeCampaignInput(input);
      ctx.db.campaigns.update(campaign.id, {
        slug: uniqueCampaignSlug(ctx, campaign.venueId, normalized.title, campaign.id),
        ...normalized,
      });
      return ctx.db.campaigns.get(campaign.id) as Campaign | null;
    }),

    deleteCampaign: mutation((ctx: DbContext, id: string): boolean => {
      const campaign = requireOwnedCampaign(ctx, id);
      for (const qrCode of listOwnerQrCodes(ctx)) {
        if (splitIds(qrCode.campaignIds).includes(campaign.id)) {
          ctx.db.qrCodes.update(qrCode.id, {
            campaignIds: joinIds(splitIds(qrCode.campaignIds).filter((campaignId) => campaignId !== campaign.id)),
          });
        }
      }
      deleteOwnedChildren(ctx, campaign.id);
      ctx.db.campaigns.delete(campaign.id);
      return true;
    }),

    createQrCode: mutation((ctx: DbContext, input: QrInput): QrCode => {
      const venue = ensureVenue(ctx);
      const campaignIds = allowedCampaignIds(ctx, venue.id, input.campaignIds);
      const appearance = normalizeQrAppearance(input);
      return insertAndRead<QrCode>(ctx.db.qrCodes, {
        ownerId: ctx.auth.userId,
        venueId: venue.id,
        publicId: uniqueQrPublicId(ctx, input.name),
        name: cleanText(input.name, 80) || "New QR code",
        description: cleanLongText(input.description, 260),
        status: normalizeQrStatus(input.status),
        campaignIds: joinIds(campaignIds),
        ...appearance,
      });
    }),

    updateQrCode: mutation((ctx: DbContext, id: string, input: QrInput): QrCode | null => {
      const qrCode = requireOwnedQrCode(ctx, id);
      const appearance = normalizeQrAppearance(input);
      ctx.db.qrCodes.update(qrCode.id, {
        name: cleanText(input.name, 80) || qrCode.name,
        description: cleanLongText(input.description, 260),
        status: normalizeQrStatus(input.status),
        campaignIds: joinIds(allowedCampaignIds(ctx, qrCode.venueId, input.campaignIds)),
        ...appearance,
      });
      return ctx.db.qrCodes.get(qrCode.id) as QrCode | null;
    }),

    deleteQrCode: mutation((ctx: DbContext, id: string): boolean => {
      const qrCode = requireOwnedQrCode(ctx, id);
      ctx.db.qrCodes.delete(qrCode.id);
      return true;
    }),

    updateLandingSettings: mutation((ctx: DbContext, input: LandingSettingsInput): LandingPageSettings => {
      const venue = ensureVenue(ctx);
      assertOwnedLandingTarget(ctx, input.targetType, input.targetId, venue.id);
      const existing = listOwnerLandingSettings(ctx).find(
        (item) => item.targetType === input.targetType && item.targetId === input.targetId,
      );
      const values = {
        ownerId: ctx.auth.userId,
        targetType: normalizeLandingTargetType(input.targetType),
        targetId: input.targetId,
        eyebrow: cleanText(input.eyebrow, 80),
        title: cleanText(input.title, 120),
        description: cleanLongText(input.description, 420),
        backgroundImageUrl: cleanText(input.backgroundImageUrl, 800),
        foregroundImageUrl: cleanText(input.foregroundImageUrl, 800),
        backgroundColor: safeColor(input.backgroundColor),
        textColor: safeColor(input.textColor),
        accentColor: safeColor(input.accentColor),
        cardColor: safeColor(input.cardColor),
      };

      if (existing) {
        ctx.db.landingPageSettings.update(existing.id, values);
        return ctx.db.landingPageSettings.get(existing.id) as LandingPageSettings;
      }

      return insertAndRead<LandingPageSettings>(ctx.db.landingPageSettings, values);
    }),

    updateVenueSettings: mutation((ctx: DbContext, input: { name: string; captionTone: string; hashtags: string; requireApproval: boolean }): Venue | null => {
      const venue = ensureVenue(ctx);
      ctx.db.venues.update(venue.id, {
        name: cleanText(input.name, 100) || venue.name,
        slug: uniqueVenueSlug(ctx, input.name || venue.name, venue.id),
        captionTone: normalizeCaptionTone(input.captionTone),
        hashtags: cleanLongText(input.hashtags, 180) || DEFAULT_HASHTAGS,
        requireApproval: Boolean(input.requireApproval),
      });
      return ctx.db.venues.get(venue.id) as Venue | null;
    }),

    submitPatronMedia: mutation((ctx: DbContext, input: SubmissionInput): SubmissionResult => {
      const result = validateSubmissionInput(ctx, input);
      if (!result.ok) {
        return result;
      }

      const campaign = result.campaign;
      const venue = result.venue;
      if (!campaign || !venue) {
        return { ok: false, submissionId: "", rewardCode: "", status: "rejected", message: "This task is not available." };
      }

      const normalizedClientToken = cleanText(input.clientToken, 80);
      const qrPublicId = cleanText(input.qrPublicId, 80);
      const duplicate = findDuplicateSubmission(ctx, campaign, qrPublicId, normalizedClientToken);

      if (duplicate) {
        const existingReward = getRewardForSubmission(ctx, duplicate.id);
        const rewardCode = duplicate.rewardCode || existingReward?.code || "";
        if (existingReward && !duplicate.rewardCode) {
          ctx.db.submissions.update(duplicate.id, {
            rewardCode: existingReward.code,
          });
        }
        return {
          ok: duplicate.status === "approved" || duplicate.status === "needs_review",
          submissionId: duplicate.id,
          rewardCode,
          status: duplicate.status,
          message: duplicate.decisionReason || duplicateStatusMessage(duplicate),
        };
      }

      const capacity = rewardCapacity(ctx, campaign);
      if (!capacity.ok) {
        return { ok: false, submissionId: "", rewardCode: "", status: "rejected", message: capacity.message };
      }

      const verification = simulateVerification(campaign, input);
      const submissionStatus = verification.status === "approved" && venue.requireApproval
        ? "needs_review" as SubmissionStatus
        : verification.status;
      const submission = insertAndRead<Submission>(ctx.db.submissions, {
        ownerId: campaign.ownerId,
        venueId: campaign.venueId,
        campaignId: campaign.id,
        clientToken: normalizedClientToken,
        patronName: cleanText(input.patronName, 60),
        mediaDataUrl: cleanText(input.mediaDataUrl, 60000),
        mediaName: cleanText(input.mediaName, 160),
        mediaMime: cleanText(input.mediaMime, 80) || "image/jpeg",
        mediaType: input.mediaMime.startsWith("video/") ? "video" : "image",
        qrPublicId,
        status: submissionStatus,
        qualityScore: String(verification.qualityScore),
        taskMatchScore: String(verification.taskMatchScore),
        safetyScore: String(verification.safetyScore),
        decisionReason: submissionStatus === "needs_review"
          ? "Submission passed automated checks and is waiting for owner approval."
          : verification.decisionReason,
        validationJson: JSON.stringify(verification),
        rewardCode: "",
        hasConsent: Boolean(input.hasConsent),
      });

      if (submissionStatus !== "approved") {
        return {
          ok: submissionStatus === "needs_review",
          submissionId: submission.id,
          rewardCode: "",
          status: submissionStatus,
          message: duplicateStatusMessage({ ...submission, status: submissionStatus }),
        };
      }

      const rewardResult = issueReward(ctx, venue, campaign, submission);
      if (!rewardResult.ok || !rewardResult.reward) {
        ctx.db.submissions.update(submission.id, {
          status: "rejected",
          decisionReason: rewardResult.message,
        });
        return {
          ok: false,
          submissionId: submission.id,
          rewardCode: "",
          status: "rejected",
          message: rewardResult.message,
        };
      }

      const reward = rewardResult.reward;
      createSocialPostDraft(ctx, venue, campaign, submission, verification);
      ctx.db.submissions.update(submission.id, {
        rewardCode: reward.code,
      });

      return {
        ok: true,
        submissionId: submission.id,
        rewardCode: reward.code,
        status: "approved",
        message: "Approved. Your reward is ready.",
      };
    }),

    retrySubmissionDecision: mutation((ctx: DbContext, submissionId: string, approve: boolean): SubmissionResult => {
      const submission = requireOwnedSubmission(ctx, submissionId);
      const campaign = requireOwnedCampaign(ctx, submission.campaignId);
      const venue = requireOwnedVenue(ctx, submission.venueId);

      if (!approve) {
        if (submission.status !== "uploaded" && submission.status !== "needs_review") {
          return {
            ok: false,
            submissionId: submission.id,
            rewardCode: submission.rewardCode,
            status: submission.status,
            message: "Only pending submissions can be rejected.",
          };
        }
        voidIssuedRewardForSubmission(ctx, submission);
        ctx.db.submissions.update(submission.id, {
          status: "rejected",
          decisionReason: "Owner requested a retake for this submission.",
        });
        return {
          ok: false,
          submissionId: submission.id,
          rewardCode: "",
          status: "rejected",
          message: "Marked rejected.",
        };
      }

      if (submission.status === "approved") {
        const existingReward = getRewardForSubmission(ctx, submission.id);
        return {
          ok: Boolean(existingReward),
          submissionId: submission.id,
          rewardCode: existingReward?.code ?? submission.rewardCode,
          status: "approved",
          message: existingReward ? "Submission is already approved." : "Submission is approved but reward could not be found.",
        };
      }

      const rewardResult = issueReward(ctx, venue, campaign, submission);
      if (!rewardResult.ok || !rewardResult.reward) {
        return {
          ok: false,
          submissionId: submission.id,
          rewardCode: "",
          status: submission.status,
          message: rewardResult.message,
        };
      }
      const reward = rewardResult.reward;

      ctx.db.submissions.update(submission.id, {
        status: "approved",
        qualityScore: submission.qualityScore || "92",
        taskMatchScore: submission.taskMatchScore || "90",
        safetyScore: submission.safetyScore || "98",
        rewardCode: reward.code,
        decisionReason: "Owner manually approved this submission.",
      });

      if (!listOwnerSocialPosts(ctx).some((post) => post.submissionId === submission.id)) {
        createSocialPostDraft(ctx, venue, campaign, submission, {
          approved: true,
          status: "approved",
          qualityScore: 92,
          taskMatchScore: 90,
          safetyScore: 98,
          decisionReason: "Owner manually approved this submission.",
          observations: ["Manual approval"],
          description: `${submission.patronName || "Guest"} completed ${campaign.title}.`,
          caption: defaultCaption(venue, campaign, submission),
        });
      }

      return {
        ok: true,
        submissionId: submission.id,
        rewardCode: reward.code,
        status: "approved",
        message: "Approved and reward issued.",
      };
    }),

    deleteSubmission: mutation((ctx: DbContext, id: string): boolean => {
      const submission = requireOwnedSubmission(ctx, id);
      for (const post of listOwnerSocialPosts(ctx).filter((item) => item.submissionId === submission.id)) {
        ctx.db.socialPosts.delete(post.id);
      }
      for (const reward of listOwnerRewards(ctx).filter((item) => item.submissionId === submission.id)) {
        ctx.db.rewards.delete(reward.id);
      }
      ctx.db.submissions.delete(submission.id);
      return true;
    }),

    lookupReward: mutation((ctx: DbContext, code: string): RewardLookupResult => lookupReward(ctx, code)),

    publicRewardLookup: mutation((ctx: DbContext, code: string): PublicRewardLookupResult => lookupPublicReward(ctx, code)),

    publicSubmissionStatus: mutation((ctx: DbContext, submissionId: string, qrPublicId: string, clientToken: string): PublicSubmissionStatus => {
      const submission = ctx.db.submissions.get(cleanText(submissionId, 80)) as Submission | null;
      const normalizedQrPublicId = cleanText(qrPublicId, 80);
      const normalizedClientToken = cleanText(clientToken, 80);
      if (
        !submission ||
        !normalizedQrPublicId ||
        normalizedClientToken.length < 16 ||
        submission.qrPublicId !== normalizedQrPublicId ||
        submission.clientToken !== normalizedClientToken
      ) {
        return { ok: false, submission: null, message: "Submission not found." };
      }

      return {
        ok: true,
        submission: {
          id: submission.id,
          campaignId: submission.campaignId,
          mediaDataUrl: submission.mediaDataUrl,
          status: submission.status,
          decisionReason: submission.decisionReason,
          rewardCode: submission.rewardCode,
        },
        message: duplicateStatusMessage(submission),
      };
    }),

    redeemReward: mutation((ctx: DbContext, code: string): RewardLookupResult => {
      const reward = getOwnedRewardByCode(ctx, normalizeRewardCode(code));
      if (!reward) {
        return { ok: false, reward: null, venueName: "", message: "Reward not found." };
      }

      const venue = requireOwnedVenue(ctx, reward.venueId);
      const current = refreshRewardExpiry(ctx, reward);
      if (current.status !== "issued") {
        return {
          ok: false,
          reward: current,
          venueName: venue.name,
          message: current.status === "expired" ? "Reward has expired." : `Reward is already ${current.status}.`,
        };
      }

      ctx.db.rewards.update(current.id, {
        status: "redeemed",
        redeemedAt: nowIso(),
      });

      const updated = ctx.db.rewards.get(current.id) as Reward;
      return {
        ok: true,
        reward: updated,
        venueName: venue.name,
        message: updated.status === "redeemed" ? "Reward marked redeemed." : `Reward is ${updated.status}.`,
      };
    }),

    regenerateSocialPostCopy: mutation((ctx: DbContext, id: string): SocialPost | null => {
      const post = requireOwnedSocialPost(ctx, id);
      const submission = ctx.db.submissions.get(post.submissionId) as Submission | null;
      const campaign = ctx.db.campaigns.get(post.campaignId) as Campaign | null;
      const venue = ctx.db.venues.get(post.venueId) as Venue | null;
      if (
        !submission ||
        !campaign ||
        !venue ||
        submission.ownerId !== ctx.auth.userId ||
        campaign.ownerId !== ctx.auth.userId ||
        venue.ownerId !== ctx.auth.userId
      ) {
        return post;
      }

      ctx.db.socialPosts.update(post.id, {
        description: `${submission.patronName || "A guest"} shared a fresh ${campaign.title.toLowerCase()} moment at ${venue.name}.`,
        caption: defaultCaption(venue, campaign, submission),
      });
      return ctx.db.socialPosts.get(post.id) as SocialPost | null;
    }),

    approveSocialPost: mutation((ctx: DbContext, id: string): SocialPost | null => {
      const post = requireOwnedSocialPost(ctx, id);
      const timestamp = nowIso();
      ctx.db.socialPosts.update(post.id, {
        status: "posted",
        approvedAt: post.approvedAt || timestamp,
        postedAt: timestamp,
      });
      return ctx.db.socialPosts.get(post.id) as SocialPost | null;
    }),
  },

  endpoints: {
    status: endpoint({ method: "GET", path: "/api/status" }, () => text("ok")),
  },
});

function getOwnerSnapshot(ctx: DbContext): OwnerSnapshot {
  const auth = getAuthSummary(ctx);
  const venues = listOwnerVenues(ctx);
  const venue = venues[0] ?? null;

  return {
    auth,
    venue,
    campaigns: sortNewest(listOwnerCampaigns(ctx)),
    qrCodes: sortNewest(listOwnerQrCodes(ctx)),
    landingSettings: sortNewest(listOwnerLandingSettings(ctx)),
    submissions: sortNewest(listOwnerSubmissions(ctx)),
    rewards: sortNewest(listOwnerRewards(ctx)),
    socialPosts: sortNewest(listOwnerSocialPosts(ctx)),
  };
}

function getPublicSnapshot(ctx: DbContext): PublicSnapshot {
  const qrCodes = listAllQrCodes(ctx).filter((qrCode) => qrCode.status === "active");
  const activeCampaignIds = new Set<string>();
  const activeVenueIds = new Set<string>();

  for (const qrCode of qrCodes) {
    for (const campaignId of splitIds(qrCode.campaignIds)) {
      activeCampaignIds.add(campaignId);
    }
    activeVenueIds.add(qrCode.venueId);
  }

  const campaigns = sortNewest(
    listAllCampaigns(ctx).filter((campaign) =>
      campaign.status === "active" &&
      activeCampaignIds.has(campaign.id) &&
      activeVenueIds.has(campaign.venueId),
    ),
  );
  const publicCampaignIds = new Set(campaigns.map((campaign) => campaign.id));
  const publicVenueIds = new Set<string>(activeVenueIds);
  for (const campaign of campaigns) {
    publicVenueIds.add(campaign.venueId);
  }
  const publicQrCodes = qrCodes
    .map((qrCode) => ({
      ...qrCode,
      ownerId: "",
      campaignIds: joinIds(splitIds(qrCode.campaignIds).filter((campaignId) => publicCampaignIds.has(campaignId))),
    }))
    .filter((qrCode) => publicVenueIds.has(qrCode.venueId));
  const publicQrIds = new Set(publicQrCodes.map((qrCode) => qrCode.id));

  return {
    venues: sortNewest(listAllVenues(ctx).filter((venue) => publicVenueIds.has(venue.id))).map(redactPublicVenue),
    campaigns: campaigns.map(redactPublicCampaign),
    qrCodes: sortNewest(publicQrCodes),
    landingSettings: sortNewest(listAllLandingSettings(ctx).filter((settings) =>
      (settings.targetType === "venue" && publicVenueIds.has(settings.targetId)) ||
      (settings.targetType === "campaign" && publicCampaignIds.has(settings.targetId)) ||
      (settings.targetType === "qr_code" && publicQrIds.has(settings.targetId)),
    )).map(redactPublicLandingSettings),
    submissions: [],
    rewards: [],
  };
}

function getAuthSummary(ctx: DbContext): OwnerAuthSummary {
  return {
    userId: ctx.auth.userId,
    displayName: cleanText(ctx.auth.displayName ?? "", 80),
    email: cleanText(ctx.auth.email ?? "", 160),
    picture: cleanText(ctx.auth.picture ?? "", 800),
    isGuest: Boolean(ctx.auth.isGuest),
  };
}

function ensureVenue(ctx: DbContext): Venue {
  const existing = listOwnerVenues(ctx)[0];
  if (existing) {
    return existing;
  }

  const auth = getAuthSummary(ctx);
  const displayName = auth.isGuest ? "" : auth.displayName;
  const name = cleanText(displayName ? `${displayName}'s Venue` : DEFAULT_VENUE_NAME, 100);

  return insertAndRead<Venue>(ctx.db.venues, {
    ownerId: ctx.auth.userId,
    name,
    slug: uniqueVenueSlug(ctx, name || DEFAULT_VENUE_SLUG, ""),
    captionTone: "warm",
    hashtags: DEFAULT_HASHTAGS,
    requireApproval: true,
  });
}

function ensureDefaultQrCode(ctx: DbContext, venue: Venue): QrCode {
  const existing = listOwnerQrCodes(ctx).find((qrCode) => qrCode.venueId === venue.id);
  if (existing) {
    return existing;
  }

  const activeCampaignIds = listOwnerCampaigns(ctx)
    .filter((campaign) => campaign.venueId === venue.id && campaign.status === "active")
    .map((campaign) => campaign.id);

  return insertAndRead<QrCode>(ctx.db.qrCodes, {
    ownerId: ctx.auth.userId,
    venueId: venue.id,
    publicId: uniqueQrPublicId(ctx, "main"),
    name: "Main QR code",
    description: "Primary customer QR code.",
    status: "active",
    campaignIds: joinIds(activeCampaignIds),
    foregroundColor: DEFAULT_QR_FOREGROUND_COLOR,
    backgroundColor: DEFAULT_QR_BACKGROUND_COLOR,
    accentColor: DEFAULT_QR_ACCENT_COLOR,
    dotStyle: DEFAULT_QR_DOT_STYLE,
    cornerStyle: DEFAULT_QR_CORNER_STYLE,
    logoImageUrl: "",
    logoSize: DEFAULT_QR_LOGO_SIZE,
  });
}

function attachCampaignToDefaultQr(ctx: DbContext, venueId: string, campaignId: string) {
  const qrCode = listOwnerQrCodes(ctx).find((item) => item.venueId === venueId);
  if (!qrCode) {
    return;
  }
  ctx.db.qrCodes.update(qrCode.id, {
    campaignIds: joinIds([...splitIds(qrCode.campaignIds), campaignId]),
  });
}

function normalizeCampaignInput(input: CampaignInput) {
  return {
    title: cleanText(input.title, 96) || "Untitled campaign",
    challengePrompt: cleanLongText(input.challengePrompt, 420) || "Take a clear photo at the table.",
    rewardLabel: cleanText(input.rewardLabel, 120) || "Free reward",
    budgetCents: dollarsToCentsText(input.budget),
    maxRedemptions: integerText(input.maxRedemptions, 0) > 0
      ? String(clamp(integerText(input.maxRedemptions, 0), 1, 100000))
      : "",
    validationThreshold: String(clamp(integerText(input.validationThreshold, 70), 20, 100)),
    status: normalizeCampaignStatus(input.status),
  };
}

function validateSubmissionInput(
  ctx: DbContext,
  input: SubmissionInput,
): SubmissionResult & { campaign?: Campaign; venue?: Venue } {
  if (!input.hasConsent) {
    return { ok: false, submissionId: "", rewardCode: "", status: "rejected", message: "Usage permission is required." };
  }

  const campaign = ctx.db.campaigns.get(input.campaignId) as Campaign | null;
  if (!campaign || campaign.status !== "active") {
    return { ok: false, submissionId: "", rewardCode: "", status: "rejected", message: "This task is not available." };
  }

  const venue = ctx.db.venues.get(campaign.venueId) as Venue | null;
  if (!venue) {
    return { ok: false, submissionId: "", rewardCode: "", status: "rejected", message: "Venue not found." };
  }

  const qrPublicId = cleanText(input.qrPublicId, 80);
  if (!qrPublicId) {
    return { ok: false, submissionId: "", rewardCode: "", status: "rejected", message: "Scan the venue QR code before submitting." };
  }

  if (cleanText(input.clientToken, 80).length < 16) {
    return { ok: false, submissionId: "", rewardCode: "", status: "rejected", message: "Submission token is missing. Refresh the QR page and try again." };
  }

  const qrCode = listAllQrCodes(ctx).find((item) => item.publicId === qrPublicId);
  if (!qrCode || qrCode.status !== "active" || qrCode.venueId !== venue.id || !splitIds(qrCode.campaignIds).includes(campaign.id)) {
    return { ok: false, submissionId: "", rewardCode: "", status: "rejected", message: "This QR code is not accepting that task." };
  }

  if (!input.mediaDataUrl || input.mediaDataUrl.length < 64) {
    return { ok: false, submissionId: "", rewardCode: "", status: "rejected", message: "Add a photo or video before submitting." };
  }

  if (input.mediaDataUrl.length > 60000) {
    return { ok: false, submissionId: "", rewardCode: "", status: "rejected", message: "Use a smaller image." };
  }

  return { ok: true, submissionId: "", rewardCode: "", status: "uploaded", message: "", campaign, venue };
}

function simulateVerification(campaign: Campaign, input: SubmissionInput) {
  const prompt = campaign.challengePrompt.toLowerCase();
  const mediaName = input.mediaName.toLowerCase();
  const token = `${input.clientToken}:${mediaName}:${prompt}`;
  let seed = 0;
  for (let index = 0; index < token.length; index += 1) {
    seed = (seed + token.charCodeAt(index) * (index + 7)) % 997;
  }

  const hasImage = input.mediaMime.startsWith("image/");
  const hasVideo = input.mediaMime.startsWith("video/");
  const formatBonus = hasImage || hasVideo ? 12 : -24;
  const consentBonus = input.hasConsent ? 8 : -30;
  const qualityScore = clamp(64 + (seed % 31) + formatBonus, 0, 100);
  const taskMatchScore = clamp(58 + ((seed * 3) % 36) + consentBonus, 0, 100);
  const safetyScore = clamp(88 + ((seed * 5) % 12), 0, 100);
  const threshold = integerText(campaign.validationThreshold, 70);
  const average = Math.round((qualityScore + taskMatchScore + safetyScore) / 3);
  const approved = average >= threshold;
  const decisionReason = approved
    ? "The submission is clear, matches the task, and usage rights were captured."
    : "The submission needs a clearer view of the requested item and venue context.";

  return {
    approved,
    status: approved ? "approved" as SubmissionStatus : "rejected" as SubmissionStatus,
    qualityScore,
    taskMatchScore,
    safetyScore,
    decisionReason,
    observations: approved
      ? ["Subject is visible", "Task appears complete", "Rights captured"]
      : ["Retake with better lighting", "Keep the table item in frame"],
    description: approved
      ? `${input.patronName || "A guest"} completed ${campaign.title}.`
      : "",
    caption: "",
  };
}

function issueReward(
  ctx: DbContext,
  venue: Venue,
  campaign: Campaign,
  submission: Submission,
): { ok: boolean; reward: Reward | null; message: string } {
  // Lakebed mutations do not expose a compare-and-swap primitive here. Keep all reward creation
  // through this function, re-read immediately before insert, and rely on mutation serialization
  // for the final protection against concurrent cap overrun.
  const existing = getRewardForSubmission(ctx, submission.id);
  if (existing) {
    const current = refreshRewardExpiry(ctx, existing);
    if (current.ownerId !== campaign.ownerId || current.campaignId !== campaign.id) {
      return { ok: false, reward: null, message: "Reward ownership does not match this submission." };
    }
    return { ok: true, reward: current, message: "Existing reward reused." };
  }

  const capacity = rewardCapacity(ctx, campaign);
  if (!capacity.ok) {
    return { ok: false, reward: null, message: capacity.message };
  }

  const latestExisting = getRewardForSubmission(ctx, submission.id);
  if (latestExisting) {
    return { ok: true, reward: refreshRewardExpiry(ctx, latestExisting), message: "Existing reward reused." };
  }

  const reward = insertAndRead<Reward>(ctx.db.rewards, {
    ownerId: campaign.ownerId,
    venueId: venue.id,
    campaignId: campaign.id,
    submissionId: submission.id,
    code: uniqueRewardCode(ctx),
    label: campaign.rewardLabel,
    status: "issued",
    expiresAt: expiryIso(30),
    redeemedAt: "",
  });
  return { ok: true, reward, message: "Reward issued." };
}

function createSocialPostDraft(
  ctx: DbContext,
  venue: Venue,
  campaign: Campaign,
  submission: Submission,
  verification: { description: string; caption: string; decisionReason: string },
): SocialPost {
  return insertAndRead<SocialPost>(ctx.db.socialPosts, {
    ownerId: campaign.ownerId,
    venueId: venue.id,
    campaignId: campaign.id,
    submissionId: submission.id,
    description: verification.description || `${submission.patronName || "A guest"} completed ${campaign.title}.`,
    caption: verification.caption || defaultCaption(venue, campaign, submission),
    channelsJson: "[\"instagram\",\"tiktok\",\"facebook\"]",
    status: "draft",
    ownerNote: verification.decisionReason,
    approvedAt: "",
    postedAt: "",
  });
}

function defaultCaption(venue: Venue, campaign: Campaign, submission: Submission): string {
  const name = submission.patronName || "A guest";
  const tone = venue.captionTone === "direct"
    ? `${name} completed ${campaign.title} at ${venue.name}.`
    : venue.captionTone === "playful"
      ? `${name} just made ${campaign.title.toLowerCase()} look easy at ${venue.name}.`
      : `${name} shared a fresh ${campaign.title.toLowerCase()} moment at ${venue.name}.`;
  return `${tone} ${venue.hashtags || DEFAULT_HASHTAGS}`;
}

function rewardCapacity(ctx: DbContext, campaign: Campaign): { ok: boolean; message: string } {
  if (campaign.status !== "active") {
    return { ok: false, message: "This campaign is not accepting rewards." };
  }

  const activeRewards = listCampaignRewards(ctx, campaign.id).filter((reward) => reward.status !== "void");
  const maxRedemptions = integerText(campaign.maxRedemptions, 0);
  if (maxRedemptions > 0 && activeRewards.length >= maxRedemptions) {
    return { ok: false, message: "This reward limit has been reached." };
  }

  const budgetCents = integerText(campaign.budgetCents, 0);
  if (budgetCents > 0) {
    const issuedValueCents = activeRewards.length * REWARD_BUDGET_UNIT_CENTS;
    if (issuedValueCents + REWARD_BUDGET_UNIT_CENTS > budgetCents) {
      return { ok: false, message: "This campaign budget has been used." };
    }
  }

  return { ok: true, message: "" };
}

function findDuplicateSubmission(
  ctx: DbContext,
  campaign: Campaign,
  qrPublicId: string,
  clientToken: string,
): Submission | null {
  if (!clientToken) {
    return null;
  }
  return (ctx.db.submissions.where("clientToken", clientToken).all() as Submission[])
    .find((submission) =>
      submission.ownerId === campaign.ownerId &&
      submission.venueId === campaign.venueId &&
      submission.campaignId === campaign.id &&
      submission.qrPublicId === qrPublicId,
    ) ?? null;
}

function duplicateStatusMessage(submission: Pick<Submission, "status" | "decisionReason">): string {
  if (submission.decisionReason) {
    return submission.decisionReason;
  }
  if (submission.status === "needs_review") {
    return "Submission saved and waiting for owner approval.";
  }
  if (submission.status === "approved") {
    return "Approved. Your reward is ready.";
  }
  return "Submission saved.";
}

function getRewardForSubmission(ctx: DbContext, submissionId: string): Reward | null {
  return listAllRewards(ctx).find((reward) => reward.submissionId === submissionId && reward.status !== "void") ?? null;
}

function voidIssuedRewardForSubmission(ctx: DbContext, submission: Submission) {
  const reward = getRewardForSubmission(ctx, submission.id);
  if (!reward || reward.status === "redeemed" || reward.status === "void") {
    return;
  }
  ctx.db.rewards.update(reward.id, {
    status: "void",
  });
  if (submission.rewardCode === reward.code) {
    ctx.db.submissions.update(submission.id, {
      rewardCode: "",
    });
  }
}

function refreshRewardExpiry(ctx: DbContext, reward: Reward): Reward {
  if (reward.status === "issued" && reward.expiresAt && Date.parse(reward.expiresAt) <= Date.now()) {
    ctx.db.rewards.update(reward.id, {
      status: "expired",
    });
    return ctx.db.rewards.get(reward.id) as Reward;
  }
  return reward;
}

function lookupReward(ctx: DbContext, code: string): RewardLookupResult {
  const normalized = normalizeRewardCode(code);
  if (!normalized) {
    return { ok: false, reward: null, venueName: "", message: "Enter a reward code." };
  }

  const reward = getOwnedRewardByCode(ctx, normalized);
  if (!reward) {
    return { ok: false, reward: null, venueName: "", message: "Reward not found." };
  }

  const venue = requireOwnedVenue(ctx, reward.venueId);
  const current = refreshRewardExpiry(ctx, reward);
  return {
    ok: true,
    reward: current,
    venueName: venue.name,
    message: `${current.label} is ${current.status}.`,
  };
}

function lookupPublicReward(ctx: DbContext, code: string): PublicRewardLookupResult {
  const normalized = normalizeRewardCode(code);
  if (!normalized) {
    return { ok: false, reward: null, venueName: "", message: "Enter a reward code." };
  }

  const reward = getRewardByCode(ctx, normalized);
  if (!reward) {
    return { ok: false, reward: null, venueName: "", message: "Reward not found." };
  }

  const venue = ctx.db.venues.get(reward.venueId) as Venue | null;
  const current = refreshRewardExpiry(ctx, reward);
  return {
    ok: true,
    reward: redactPublicReward(current),
    venueName: venue?.name ?? "the venue",
    message: `${current.label} is ${current.status}.`,
  };
}

function redactPublicReward(reward: Reward): PublicReward {
  return {
    code: reward.code,
    label: reward.label,
    status: reward.status,
    expiresAt: reward.expiresAt,
  };
}

function getRewardByCode(ctx: DbContext, code: string): Reward | null {
  const normalized = normalizeRewardCode(code);
  return listAllRewards(ctx).find((reward) => reward.code === normalized) ?? null;
}

function getOwnedRewardByCode(ctx: DbContext, code: string): Reward | null {
  const normalized = normalizeRewardCode(code);
  return listOwnerRewards(ctx).find((reward) => reward.code === normalized) ?? null;
}

function requireOwnedVenue(ctx: DbContext, id: string): Venue {
  const venue = ctx.db.venues.get(id) as Venue | null;
  if (!venue || venue.ownerId !== ctx.auth.userId) {
    throw new Error("Venue not found");
  }
  return venue;
}

function requireOwnedCampaign(ctx: DbContext, id: string): Campaign {
  const campaign = ctx.db.campaigns.get(id) as Campaign | null;
  if (!campaign || campaign.ownerId !== ctx.auth.userId) {
    throw new Error("Campaign not found");
  }
  return campaign;
}

function requireOwnedQrCode(ctx: DbContext, id: string): QrCode {
  const qrCode = ctx.db.qrCodes.get(id) as QrCode | null;
  if (!qrCode || qrCode.ownerId !== ctx.auth.userId) {
    throw new Error("QR code not found");
  }
  return qrCode;
}

function requireOwnedSubmission(ctx: DbContext, id: string): Submission {
  const submission = ctx.db.submissions.get(id) as Submission | null;
  if (!submission || submission.ownerId !== ctx.auth.userId) {
    throw new Error("Submission not found");
  }
  return submission;
}

function requireOwnedSocialPost(ctx: DbContext, id: string): SocialPost {
  const post = ctx.db.socialPosts.get(id) as SocialPost | null;
  if (!post || post.ownerId !== ctx.auth.userId) {
    throw new Error("Social post not found");
  }
  return post;
}

function assertOwnedLandingTarget(ctx: DbContext, targetType: LandingPageTargetType, targetId: string, venueId: string) {
  if (targetType === "venue") {
    if (targetId !== venueId) {
      throw new Error("Venue not found");
    }
    return;
  }

  if (targetType === "campaign") {
    const campaign = requireOwnedCampaign(ctx, targetId);
    if (campaign.venueId !== venueId) {
      throw new Error("Campaign not found");
    }
    return;
  }

  const qrCode = requireOwnedQrCode(ctx, targetId);
  if (qrCode.venueId !== venueId) {
    throw new Error("QR code not found");
  }
}

function redactPublicVenue(venue: Venue): Venue {
  return {
    ...venue,
    ownerId: "",
    captionTone: "",
    hashtags: "",
    requireApproval: false,
  };
}

function redactPublicCampaign(campaign: Campaign): Campaign {
  return {
    ...campaign,
    ownerId: "",
    budgetCents: "",
    maxRedemptions: "",
    validationThreshold: "",
  };
}

function redactPublicLandingSettings(settings: LandingPageSettings): LandingPageSettings {
  return {
    ...settings,
    ownerId: "",
  };
}

function deleteOwnedChildren(ctx: DbContext, campaignId: string) {
  for (const submission of listOwnerSubmissions(ctx).filter((item) => item.campaignId === campaignId)) {
    for (const post of listOwnerSocialPosts(ctx).filter((item) => item.submissionId === submission.id)) {
      ctx.db.socialPosts.delete(post.id);
    }
    for (const reward of listOwnerRewards(ctx).filter((item) => item.submissionId === submission.id)) {
      ctx.db.rewards.delete(reward.id);
    }
    ctx.db.submissions.delete(submission.id);
  }

  for (const post of listOwnerSocialPosts(ctx).filter((item) => item.campaignId === campaignId)) {
    ctx.db.socialPosts.delete(post.id);
  }
  for (const reward of listOwnerRewards(ctx).filter((item) => item.campaignId === campaignId)) {
    ctx.db.rewards.delete(reward.id);
  }
}

function allowedCampaignIds(ctx: DbContext, venueId: string, ids: string[]) {
  const allowed = new Set(listOwnerCampaigns(ctx).filter((campaign) => campaign.venueId === venueId).map((campaign) => campaign.id));
  return ids.filter((id) => allowed.has(id));
}

function uniqueVenueSlug(ctx: DbContext, input: string, currentId: string): string {
  return uniqueSlug(ctx, slugify(input, DEFAULT_VENUE_SLUG), (candidate) =>
    listAllVenues(ctx).some((venue) => venue.id !== currentId && venue.slug === candidate),
  );
}

function uniqueCampaignSlug(ctx: DbContext, venueId: string, title: string, currentId: string): string {
  return uniqueSlug(ctx, slugify(title, "campaign"), (candidate) =>
    listOwnerCampaigns(ctx).some((campaign) =>
      campaign.id !== currentId && campaign.venueId === venueId && campaign.slug === candidate,
    ),
  );
}

function uniqueQrPublicId(ctx: DbContext, seed: string): string {
  const base = slugify(seed, "qr").slice(0, 16);
  return uniqueSlug(ctx, `${base}-${randomToken(4)}`, (candidate) =>
    listAllQrCodes(ctx).some((qrCode) => qrCode.publicId === candidate),
  );
}

function uniqueRewardCode(ctx: DbContext): string {
  for (let index = 0; index < 100; index += 1) {
    const code = `BRIBE-${randomToken(8).toUpperCase()}`;
    if (!getRewardByCode(ctx, code)) {
      return code;
    }
  }
  return `BRIBE-${Date.now().toString(36).toUpperCase()}`;
}

function uniqueSlug(ctx: DbContext, base: string, exists: (candidate: string) => boolean): string {
  const normalized = slugify(base, "item").slice(0, 42);
  for (let index = 0; index < 50; index += 1) {
    const candidate = index === 0 ? normalized : `${normalized}-${index + 1}`;
    if (!exists(candidate)) {
      return candidate;
    }
  }
  return `${normalized}-${makeId("slug").slice(-6)}`;
}

function normalizeRewardCode(value: string): string {
  return cleanText(value, 40).toUpperCase();
}

function normalizeCampaignStatus(value: string): CampaignStatus {
  return value === "draft" || value === "paused" || value === "ended" ? value : "active";
}

function normalizeQrStatus(value: string): QrCodeStatus {
  return value === "paused" || value === "archived" ? value : "active";
}

function normalizeQrAppearance(input: Partial<QrInput>) {
  return {
    foregroundColor: safeColor(String(input.foregroundColor ?? "")) || DEFAULT_QR_FOREGROUND_COLOR,
    backgroundColor: safeColor(String(input.backgroundColor ?? "")) || DEFAULT_QR_BACKGROUND_COLOR,
    accentColor: safeColor(String(input.accentColor ?? "")) || DEFAULT_QR_ACCENT_COLOR,
    dotStyle: normalizeQrDotStyle(String(input.dotStyle ?? "")),
    cornerStyle: normalizeQrCornerStyle(String(input.cornerStyle ?? "")),
    logoImageUrl: normalizeQrLogoUrl(String(input.logoImageUrl ?? "")),
    logoSize: String(clamp(integerText(String(input.logoSize ?? DEFAULT_QR_LOGO_SIZE), Number(DEFAULT_QR_LOGO_SIZE)), 0, 28)),
  };
}

function normalizeQrDotStyle(value: string): QrDotStyle {
  return value === "dots" || value === "classy" || value === "square" ? value : DEFAULT_QR_DOT_STYLE;
}

function normalizeQrCornerStyle(value: string): QrCornerStyle {
  return value === "rounded" || value === "square" ? value : DEFAULT_QR_CORNER_STYLE;
}

function normalizeQrLogoUrl(value: string): string {
  const cleaned = cleanText(value, 800);
  if (!cleaned) {
    return "";
  }
  return /^https?:\/\/[^\s"'<>]+$/i.test(cleaned) ? cleaned : "";
}

function normalizeLandingTargetType(value: string): LandingPageTargetType {
  if (value === "campaign" || value === "qr_code") {
    return value;
  }
  return "venue";
}

function normalizeCaptionTone(value: string): string {
  return value === "direct" || value === "playful" ? value : "warm";
}

function insertAndRead<T extends { id: string }>(tableApi: any, value: Record<string, unknown>): T {
  const inserted = tableApi.insert(value) as T | string | undefined;
  if (inserted && typeof inserted === "object" && typeof inserted.id === "string") {
    return inserted as T;
  }
  if (typeof inserted === "string") {
    return tableApi.get(inserted) as T;
  }
  const rows = tableApi.orderBy("createdAt", "desc").limit(1).all() as T[];
  const row = rows[0];
  if (!row) {
    throw new Error("Insert failed");
  }
  return row;
}

function listOwnerVenues(ctx: DbContext): Venue[] {
  return ctx.db.venues.where("ownerId", ctx.auth.userId).orderBy("createdAt", "desc").all() as Venue[];
}

function listOwnerCampaigns(ctx: DbContext): Campaign[] {
  return ctx.db.campaigns.where("ownerId", ctx.auth.userId).orderBy("createdAt", "desc").all() as Campaign[];
}

function listOwnerQrCodes(ctx: DbContext): QrCode[] {
  return ctx.db.qrCodes.where("ownerId", ctx.auth.userId).orderBy("createdAt", "desc").all() as QrCode[];
}

function listOwnerLandingSettings(ctx: DbContext): LandingPageSettings[] {
  return ctx.db.landingPageSettings.where("ownerId", ctx.auth.userId).orderBy("createdAt", "desc").all() as LandingPageSettings[];
}

function listOwnerSubmissions(ctx: DbContext): Submission[] {
  return ctx.db.submissions.where("ownerId", ctx.auth.userId).orderBy("createdAt", "desc").all() as Submission[];
}

function listOwnerRewards(ctx: DbContext): Reward[] {
  return ctx.db.rewards.where("ownerId", ctx.auth.userId).orderBy("createdAt", "desc").all() as Reward[];
}

function listOwnerSocialPosts(ctx: DbContext): SocialPost[] {
  return ctx.db.socialPosts.where("ownerId", ctx.auth.userId).orderBy("createdAt", "desc").all() as SocialPost[];
}

function listAllVenues(ctx: DbContext): Venue[] {
  return ctx.db.venues.orderBy("createdAt", "desc").limit(300).all() as Venue[];
}

function listAllCampaigns(ctx: DbContext): Campaign[] {
  return ctx.db.campaigns.orderBy("createdAt", "desc").limit(500).all() as Campaign[];
}

function listAllQrCodes(ctx: DbContext): QrCode[] {
  return ctx.db.qrCodes.orderBy("createdAt", "desc").limit(500).all() as QrCode[];
}

function listAllLandingSettings(ctx: DbContext): LandingPageSettings[] {
  return ctx.db.landingPageSettings.orderBy("createdAt", "desc").limit(500).all() as LandingPageSettings[];
}

function listAllRewards(ctx: DbContext): Reward[] {
  return ctx.db.rewards.orderBy("createdAt", "desc").limit(1000).all() as Reward[];
}

function listCampaignRewards(ctx: DbContext, campaignId: string): Reward[] {
  return ctx.db.rewards.where("campaignId", campaignId).orderBy("createdAt", "desc").all() as Reward[];
}

function nowIso(): string {
  return new Date().toISOString();
}

function expiryIso(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${randomToken(5)}`;
}

function randomToken(length: number): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let value = "";
  for (let index = 0; index < length; index += 1) {
    value += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return value;
}
