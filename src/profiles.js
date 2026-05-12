export const businessProfiles = [
  {
    id: "teuwen",
    company: "Teuwen",
    website: "http://www.teuwen.com",
    creatorBackground:
      "Company: Teuwen. An award-winning food, wine, and spirits public relations and marketing agency. Services include integrated campaigns, content creation, press relations, bespoke events, trade relations, partnerships, influencer and digital tactics, and strategic consulting. Identify live world news relevant to food, wine, spirits, hospitality, restaurants, consumer packaged goods, trade and supply chain, food safety, tariffs, commodity prices, events, culture, consumer sentiment, brand reputation, and PR opportunities."
  },
  {
    id: "careersherpa",
    company: "CareerSherpa.net",
    website: "http://www.careersherpa.net",
    creatorBackground:
      "Company: CareerSherpa.net. Hannah Morgan provides job search, career, resume, interviewing, LinkedIn, social media, and career management strategy for professionals changing jobs. Identify live world news relevant to job market trends, hiring, layoffs, recruiting, workplace shifts, labor policy, AI in job search, resumes, interviews, social media strategy, career risk, professional branding, and content opportunities for job seekers."
  }
];

export function findProfiles(profileIds = []) {
  if (profileIds.length === 0) {
    return businessProfiles;
  }

  const selected = profileIds.map((id) => {
    const profile = businessProfiles.find((candidate) => candidate.id === id);
    if (!profile) {
      throw new Error(
        `Unknown profile "${id}". Available profiles: ${businessProfiles
          .map((candidate) => candidate.id)
          .join(", ")}`
      );
    }
    return profile;
  });

  return selected;
}
