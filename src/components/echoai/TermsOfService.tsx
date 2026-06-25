"use client";

import { LegalContactBlock, LegalPage, type LegalSection } from "./LegalPage";

const LAST_UPDATED = "June 25, 2025";

const SECTIONS: LegalSection[] = [
  {
    title: "Agreement to Terms",
    paragraphs: [
      "These Terms of Service govern your access to and use of Nexus Music, including the web app, progressive web app experience, and related APIs.",
      "By accessing or using Nexus Music, you agree to these Terms and our Privacy Policy. If you do not agree, do not use the service.",
    ],
  },
  {
    title: "Description of Service",
    paragraphs: [
      "Nexus Music is a music discovery and playback platform that integrates YouTube content, AI-powered recommendations, lyrics, listening statistics, and optional social features such as Jam sessions and friend activity.",
      "We may modify, suspend, or discontinue any part of the service at any time, with or without notice.",
    ],
  },
  {
    title: "Accounts & Authentication",
    paragraphs: [
      "Certain features require signing in with a Google account. You are responsible for maintaining the security of your account credentials and for all activity that occurs under your account.",
      "You must provide accurate information and comply with Google's terms when authorizing Nexus Music to access your YouTube account.",
      "We may suspend or terminate access if we reasonably believe your account is being used in violation of these Terms.",
    ],
  },
  {
    title: "Acceptable Use",
    paragraphs: ["You agree not to:"],
    list: [
      "Use Nexus Music for any unlawful purpose or in violation of applicable copyright and licensing laws.",
      "Attempt to reverse engineer, scrape, overload, or disrupt the service or its infrastructure.",
      "Circumvent access controls, rate limits, or authentication requirements.",
      "Harass, impersonate, or mislead other users through social or Jam session features.",
      "Use automated tools to extract content or data from the service without permission.",
    ],
  },
  {
    title: "Third-Party Content & Services",
    paragraphs: [
      "Music, videos, artwork, lyrics, and metadata available through Nexus Music are provided by third parties, including YouTube, artists, labels, and data partners. Nexus Music does not claim ownership of that content.",
      "Your use of third-party content is subject to the terms and policies of those providers. We are not responsible for the accuracy, availability, or legality of third-party content.",
      "AI-generated recommendations, insights, and summaries are provided for informational purposes only and may be incomplete or inaccurate.",
    ],
  },
  {
    title: "Jam Sessions & Social Features",
    paragraphs: [
      "Jam sessions and friend activity features allow real-time sharing of playback state with other users. By participating, you consent to sharing relevant playback information with session participants.",
      "You are solely responsible for the content you share and for respecting the privacy of others when using social features.",
    ],
  },
  {
    title: "Intellectual Property",
    paragraphs: [
      "The Nexus Music name, branding, interface design, and original software are protected by applicable intellectual property laws. You may not copy, modify, or distribute our software except as permitted by law or with our written consent.",
      "Feedback you provide may be used by us without obligation or compensation to you.",
    ],
  },
  {
    title: "Disclaimer of Warranties",
    paragraphs: [
      "Nexus Music is provided on an \"as is\" and \"as available\" basis without warranties of any kind, whether express or implied, including merchantability, fitness for a particular purpose, and non-infringement.",
      "We do not guarantee uninterrupted, secure, or error-free operation, nor that content will always be available or correctly identified.",
    ],
  },
  {
    title: "Limitation of Liability",
    paragraphs: [
      "To the fullest extent permitted by law, Nexus Music and its operators will not be liable for any indirect, incidental, special, consequential, or punitive damages, or for any loss of data, profits, or goodwill arising from your use of the service.",
      "Our total liability for any claim related to the service will not exceed the amount you paid to use Nexus Music in the twelve months before the claim, or zero if the service is provided free of charge.",
    ],
  },
  {
    title: "Termination",
    paragraphs: [
      "You may stop using Nexus Music at any time by signing out and discontinuing use of the service.",
      "We may suspend or terminate your access if you violate these Terms or if continued access poses a risk to the service or other users.",
    ],
  },
  {
    title: "Changes to Terms",
    paragraphs: [
      "We may update these Terms from time to time. Material changes will be reflected by updating the \"Last updated\" date on this page. Your continued use after changes take effect constitutes acceptance of the revised Terms.",
    ],
  },
  {
    title: "Contact",
    content: (
      <LegalContactBlock intro="Questions about these Terms may be directed to the developer:" />
    ),
  },
];

export function TermsOfService() {
  return (
    <LegalPage
      title="Terms of Service"
      subtitle="Rules and conditions for using Nexus Music."
      lastUpdated={LAST_UPDATED}
      sections={SECTIONS}
      sibling={{ label: "Privacy Policy", href: "/privacy" }}
    />
  );
}
