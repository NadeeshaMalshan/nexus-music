"use client";

import { LegalContactBlock, LegalPage, type LegalSection } from "./LegalPage";

const LAST_UPDATED = "June 25, 2025";

const SECTIONS: LegalSection[] = [
  {
    title: "Overview",
    paragraphs: [
      "Nexus Music is an AI-powered music dashboard that combines YouTube playback, personalized recommendations, and social listening features. This Privacy Policy explains what information we collect, how we use it, and the choices you have when using the service.",
      "By signing in or using Nexus Music, you agree to the practices described here. If you do not agree, please do not use the service.",
    ],
  },
  {
    title: "Information We Collect",
    paragraphs: ["We collect information in the following ways:"],
    list: [
      "Account information when you sign in with Google, including your name, email address, and profile photo.",
      "YouTube library data when you connect your account, including playlists, liked videos, subscriptions, and related metadata accessed through the YouTube API.",
      "Playback and listening activity, such as songs played, queue history, listening time, top artists, discovered tracks, and Wrapped-style yearly summaries.",
      "Preferences you set in the app, including audio and video quality, crossfade, autoplay, and interface options.",
      "Social and session data when you use Jam sessions, follow other users, or share your listening status with friends.",
      "Device and usage data needed to operate the service, such as session tokens, sync timestamps, and real-time connection identifiers.",
    ],
  },
  {
    title: "How We Use Your Information",
    paragraphs: ["We use the information we collect to:"],
    list: [
      "Authenticate you and keep your session secure across devices.",
      "Sync your YouTube library, liked songs, and playlists inside Nexus Music.",
      "Power playback, queue management, lyrics, artist pages, and search.",
      "Generate personalized recommendations and AI-driven music insights.",
      "Track listening statistics, profile activity, and social features such as friend status.",
      "Improve reliability, debug issues, and maintain the service.",
    ],
  },
  {
    title: "Local Storage & Cookies",
    paragraphs: [
      "Some settings and session-related data may be stored locally in your browser so the app can remember your preferences and keep you signed in.",
      "We use authentication cookies managed through NextAuth as part of the sign-in flow. You can clear site data in your browser, though doing so may sign you out and reset local preferences.",
    ],
  },
  {
    title: "Third-Party Services",
    paragraphs: [
      "Nexus Music relies on third-party providers to deliver core functionality. These services may process data according to their own policies:",
    ],
    list: [
      "Google / YouTube: sign-in, YouTube Data API access, and music playback.",
      "Upstash Redis: secure storage of synced library data, stats, and user activity on our backend.",
      "Pusher: real-time updates for Jam sessions, friend activity, and cross-device sync.",
      "Google Gemini: AI-generated music recommendations and profile insights.",
      "Genius and lyrics.ovh: lyrics lookup and song metadata.",
      "YouTube Music and related content APIs: search, browse, streaming metadata, and artwork.",
    ],
  },
  {
    title: "Data Retention",
    paragraphs: [
      "We retain account-linked data for as long as your account remains active and as needed to provide the service.",
      "Daily listening activity records are kept for up to 400 days, after which they expire automatically.",
      "You may request deletion of your account data by contacting us. Some information may persist in backups for a limited period before being removed.",
    ],
  },
  {
    title: "Sharing of Information",
    paragraphs: [
      "We do not sell your personal information. We share data only with service providers that help us operate Nexus Music, when required by law, or when you choose to make information visible to other users (for example, public profile stats or live listening status with friends).",
      "Music content itself is streamed from third-party platforms and remains subject to those platforms' terms and licensing.",
    ],
  },
  {
    title: "Your Choices & Rights",
    paragraphs: ["Depending on where you live, you may have the right to:"],
    list: [
      "Access, correct, or delete personal data associated with your account.",
      "Withdraw Google account permissions through your Google Account settings.",
      "Sign out of Nexus Music at any time from Settings.",
      "Limit optional social features by not joining Jam sessions or following other users.",
    ],
  },
  {
    title: "Children's Privacy",
    paragraphs: [
      "Nexus Music is not directed at children under 13. We do not knowingly collect personal information from children. If you believe a child has provided us data, please contact us so we can remove it.",
    ],
  },
  {
    title: "Changes to This Policy",
    paragraphs: [
      "We may update this Privacy Policy from time to time. When we do, we will revise the \"Last updated\" date at the top of this page. Continued use of Nexus Music after changes become effective means you accept the updated policy.",
    ],
  },
  {
    title: "Contact",
    content: (
      <LegalContactBlock intro="If you have questions about this Privacy Policy or how your data is handled, contact the developer:" />
    ),
  },
];

export function PrivacyPolicy() {
  return (
    <LegalPage
      title="Privacy Policy"
      subtitle="How Nexus Music collects, uses, and protects your data."
      lastUpdated={LAST_UPDATED}
      sections={SECTIONS}
      sibling={{ label: "Terms of Service", href: "/terms" }}
    />
  );
}
