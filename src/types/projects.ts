export type ProjectStatus = 'planned' | 'in-progress' | 'in-services' | 'completed' | 'archived';
export type ProjectCategory = 'app' | 'api' | 'library' | 'tool' | 'service' | 'website' | 'other';

export interface ProjectTech {
  languages?: string[];
  frameworks?: string[];
  tools?: string[];
  platforms?: string[];
  databases?: string[];
}

export interface ProjectTeam {
  size?: number;
  role?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;           // brief, for cards
  shortDescription?: string;     // tagline
  longDescription?: string;      // full writeup (for details page later)
  tech?: ProjectTech;
  year?: number;
  startDate?: string;            // YYYY or YYYY-MM
  endDate?: string;
  github?: string;
  homepage?: string;
  status?: ProjectStatus;
  category?: ProjectCategory;
  role?: string;
  team?: ProjectTeam;
  featured?: boolean;
  highlights?: string[];
  tags?: string[];
}
