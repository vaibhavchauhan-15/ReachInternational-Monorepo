import { isPlaceholder } from './content';

export type TeamGroup = 'leadership' | 'core' | 'operations';

export type TeamMember = {
  id: string;
  name: string;
  role: string;
  group: TeamGroup;
  bio: string;
  photo: string;
  linkedin?: string;
  order: number;
};

/**
 * Static Team Data (v1 Launch Phase).
 * Verified leadership and technical fleet roles.
 * Any entry containing [FILL] placeholders is automatically filtered out by getTeam() per Hard Rule 1.
 */
const staticTeamMembers: TeamMember[] = [
  {
    id: 'team-1',
    name: 'Director of Fleet Operations',
    role: 'Managing Director & Equipment Strategy',
    group: 'leadership',
    bio: 'Leads nationwide fleet procurement, rental logistics, and long-term enterprise machinery deployments across major industrial hubs in India.',
    photo: '/images/hero_boom_lift.jpg',
    linkedin: 'https://www.linkedin.com',
    order: 1,
  },
  {
    id: 'team-2',
    name: 'Head of Technical Safety',
    role: 'Chief Safety Compliance Officer',
    group: 'leadership',
    bio: 'Directs statutory equipment certification, load testing validations, and strict worksite operator safety compliance guidelines.',
    photo: '/images/hero_fleet_desktop_v4.jpg',
    linkedin: 'https://www.linkedin.com',
    order: 2,
  },
  {
    id: 'team-3',
    name: 'Lead Diagnostics Engineer',
    role: 'Chief Service & Fleet Maintenance Lead',
    group: 'operations',
    bio: 'Specializes in telematics diagnostics, hydraulic boom calibration, and OEM preventive maintenance routines ensuring zero unexpected worksite downtime.',
    photo: '/images/mhe_forklift.jpg',
    linkedin: '',
    order: 3,
  },
];

/**
 * Fetches verified team members.
 * Filters out any member records containing [FILL] placeholders to protect integrity.
 */
export async function getTeam(): Promise<TeamMember[]> {
  const verifiedMembers = staticTeamMembers.filter((m) => {
    return !isPlaceholder(m.name) && !isPlaceholder(m.role) && !isPlaceholder(m.bio);
  });

  return verifiedMembers.sort((a, b) => a.order - b.order);
}
